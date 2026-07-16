# Reading a LinkedIn company page (and the web-search fallback)

## LinkedIn About page

On a LinkedIn company page's About tab, the content you want is in the panel usually
labeled **"Overview"** (a paragraph or two describing what the company does) and a set of
key-value fields below it that typically includes **"Founded"** alongside things like
Industry, Company size, Headquarters, Specialties. Not every company page has all of
these filled in — a missing Founded field means the year isn't available on LinkedIn, not
that you should guess one.

What to do with the Overview text:
- Don't copy it verbatim into the CRM `description` field. LinkedIn's text is often
  written in first person ("We are...") or marketing voice — paraphrase into a short,
  neutral 2–4 sentence markdown description: what the company/fund does, its focus, and
  anything distinctive (stage, sector, geography) if the Overview mentions it.
- Keep it factual. Don't add claims that aren't in the source text.

What counts as "Founded":
- Take it as a plain integer year, e.g. `2019`. If LinkedIn shows a full date, use just
  the year.
- If the field says something vague ("N/A" or isn't present at all), treat it as not
  found — don't infer a year from unrelated context (e.g. a funding round date).

## Confirming you have the right page

LinkedIn has many similarly-named company pages (holding companies, regional
subsidiaries, unrelated companies with the same name). Before trusting the page, check at
least one of:
- The page's website link matches the CRM record's `website`.
- The industry/description plausibly matches what the CRM already knows about the
  company (e.g. `country`, `industry_ids` context from `crm_get_company`).

If you're not confident it's the right page, say so to the user and ask them to confirm,
rather than proposing data from the wrong company.

## Web-search fallback

When LinkedIn isn't usable (no page, login declined, missing field), search for the
company's own site (an "About us" / "Who we are" page) or a reputable database entry
(Crunchbase, PitchBook, Wikipedia). Same rules apply: paraphrase rather than copy,
integer year only, and don't guess when the field genuinely isn't stated anywhere you can
find. Always report which source you ended up using so the user can spot-check it.
