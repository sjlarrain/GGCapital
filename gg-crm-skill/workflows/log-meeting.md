# Workflow: log a meeting from notes/a transcript

Goal: turn freeform meeting input (notes, a transcript, a calendar invite) into a `meetings`
record with its attendees linked — creating or staging each participant and company along the
way, never blocking the whole meeting on one unresolved person.

## Steps

1. **Extract** from the source: a title, a date, the notes text, and a list of participants —
   each with whatever's available: `name`, `email`, `company_name`.
   - **No date found → use today's date** (the date of ingestion), not a hard failure.
   - **No title found →** synthesize one, e.g. `"Meeting with {company}"`.

2. **Resolve each participant** (do this before creating the meeting):
   1. `crm_search` on the participant's name/email.
      - Confident match → reuse that `contact_id`. If they mentioned a role/company the
        existing contact is missing, `crm_update_contact` to fill it in.
   2. No match → resolve their company first:
      - `crm_search` the company name.
      - Found → use its `id`.
      - Not found → **ask the user** what the company does and where it's based (don't
        guess, don't leave it blank) before calling `crm_create_company` with
        `{ name, description, country }`.
   3. Now create the contact:
      - Has an email → `crm_create_contact({ name, email, company_id })`.
      - **No email found anywhere →** don't block. Call `staging_ingest` with
        `event_class: "new_contact"`, `proposed_links.contact: { name, company_id }`, and a note
        that it's missing an email. This participant goes to `/triage`; the meeting still gets
        created without them linked (you can link them with `crm_set_meeting_participants` once
        they're promoted, by re-running this tool with the full attendee list).

3. **Pick the meeting's company.** A meeting has exactly one `company_id`. If every
   participant is from the same outside company, that's it. If participants span more than one
   outside company, pick the one the meeting is primarily *with* — ask the user only if that's
   genuinely unclear. Other companies/participants mentioned stay in the notes text; the schema
   doesn't support multiple companies per meeting.

4. **Create the meeting.** `crm_create_meeting({ company_id, date, title, notes, type_id? })`.
   Map a free-text meeting type via `tags_list.meetingTypes` (see `reference/verification-rules.md`
   for the alias list) if one is implied; leave `type_id` unset otherwise — don't guess.

5. **Link participants.** `crm_set_meeting_participants({ meeting_id, contact_ids })` with
   every contact resolved or created in step 2 (skip anyone who went to staging in step 2.iii).

6. **Report back.** Say what was created live (meeting + any new company/contacts) and what's
   sitting in `/triage` awaiting a real email before it can be linked.

## Why stage instead of guessing

Same rule as everywhere else in this Skill (`reference/verification-rules.md`): a contact needs
name + email + company to be created directly. A participant missing one of those is incomplete
data, not a reason to stop logging the meeting — stage them and keep going.
