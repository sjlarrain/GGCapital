# Verification rules (must mirror the server)

These are the exact gates the server enforces in `src/lib/staging/rules.ts` and
`src/lib/staging/mappings.ts`. A staged event is classified into one of:

- **needs_info** — a hard gate failed (see below). Never promotable until fixed.
- **classified** — gates pass but `confidence < 0.85`. Awaiting review.
- **ready** — gates pass and `confidence ≥ 0.85`. Eligible for promotion.

Apply the same rules yourself *before* calling `crm_create_*`: if any gate would fail,
call `staging_ingest` instead.

## Hard field gates → `needs_info`

| Class         | Requires |
| ------------- | -------- |
| `new_company` | company `name` (or an existing company `id`) |
| `new_contact` | contact `name` + `email` + a company (`company_id` or a company name/id) |
| `meeting`     | a company + a `date` |

Blocking reasons: `missing_company_name`, `missing_contact_name`, `missing_contact_email`,
`missing_company`, `missing_date`.

## Confidence threshold

`CONFIDENCE_THRESHOLD = 0.85`. Below it, the event stays for review even if all fields are
present. Set `confidence` honestly on `staging_ingest`.

## Dedupe gate → `needs_info`

Before creating, the server searches existing records (company by normalized name, contact
by email then name):

- Exactly one confident match → `duplicate_company` / `duplicate_contact` — **link it**,
  don't create.
- Several weak candidates → `ambiguous_company` / `ambiguous_contact` — a human/agent must
  pick.

Mirror this by calling `crm_search` first.

## Tag-mapping gate → `needs_info` (`unmapped_tag`)

Free-text tag fields (`industry`, `region`, `stage`, `type`, `status`, `meeting_type` on the
extracted data or proposed company/contact) must map to a known catalog name. Unmapped free
text → `unmapped_tag`. Resolved `*_ids` are never treated as free text.

### Alias map (free text → canonical catalog name)

Matching is case- and accent-insensitive; multi-value cells take the first comma token.

- **industry**: ai→AI, agnostic/b2b→Agnostic, climate tech→Climate Tech, data→Data,
  e-commerce/ecommerce→E-Commerce, fintech→Fintech, foodtech→Foodtech, gaming→Gaming,
  healthtech→Healthtech, insurtech→Insurtech, life science→Life Science,
  logistic/logistics→Logistic, marketplace→Marketplace, mobility→Mobility, pet tech→Pet Tech,
  proptech→Proptech, retail/retailtech→Retailtech, saas→SaaS, secondaries→Secondaries,
  traveltech→Traveltech, wellness→Wellness
- **region**: usa/us/eeuu/ee.uu./estados unidos→United States, latam/latinoamerica→Latin America,
  brasil→Brazil, méxico→Mexico, perú→Peru, españa/espana→Spain, world→Global, uk/reino unido→United Kingdom,
  oceania→Australia, … (plus direct country names: Chile, Argentina, Colombia, Europe, Asia, …)
- **stage**: pre-seed→Pre-Seed, seed→Seed, series a/b/c→Series A/B/C, series d+→Series D+,
  growth→Growth, pre-ipo→Pre-IPO, listed→Listed, mature→Mature, late stage→Late Stage,
  venture debt/venturedebt→Venture Debt, vc fundraising→VC Fundraising, non deal roadshow→Non Deal Roadshow
- **type**: vc→VC, ffoo→Family Office, cvc→Corporate VC, network→Network, fund→Fund, company→Company
- **status**: approved→Approved, contact/meeting→Active, funnel/stand-by→Watch, miss/rejected→Rejected
- **meeting_type**: meeting→Meeting, pitch→Pitch, network→Network, update→Update, legal→Legal

If a value isn't here, treat it as unmapped: stage the event and let review add the tag.
