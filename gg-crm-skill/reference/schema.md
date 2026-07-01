# CRM data model

All ids are UUIDs. Tag id fields must come from `tags_list`. `data_status`
(`stub` | `partial` | `complete`) and `missing_fields` are computed by the server — you
don't set them, but you read them to know what still needs enriching.

## Company (`crm_create_company` / `crm_update_company`)

| Field                  | Req | Notes |
| ---------------------- | --- | ----- |
| `name`                 | ✅  | Company name. |
| `description`          |     | Short thesis / what they do. |
| `source`               |     | `Direct` or `Fund`. |
| `website`              |     | URL. |
| `country`              |     | Free text. |
| `industry_ids`         |     | uuid[] from `tags_list.industries`. |
| `region_ids`           |     | uuid[] from `tags_list.regions`. |
| `stage_ids`            |     | uuid[] from `tags_list.stages`. |
| `investment_stage_ids` |     | uuid[] from `tags_list.stages` (fund's focus). |
| `type_id`              |     | uuid from `tags_list.types`. |
| `status_id`            |     | uuid from `tags_list.statuses`. |
| `parent_company_id`    |     | uuid of parent (e.g. fund → firm). |
| `round_size_musd`      |     | number (MUSD). |
| `valuation_musd`       |     | number (MUSD). |
| `deal_date`            |     | YYYY-MM-DD. |
| `legal`                |     | Free text. |

## Contact (`crm_create_contact` / `crm_update_contact`)

| Field              | Req | Notes |
| ------------------ | --- | ----- |
| `name`             | ✅  | Full name. |
| `email`            | ✅  | Required — the strong dedupe key. |
| `company_id`       | ✅  | uuid of an existing company (search/create it first). |
| `role`             |     | Title. |
| `employer`         |     | If different from the linked company. |
| `phone`            |     | |
| `expertise`        |     | Free text. |
| `investment_focus` |     | string[]. |
| `industry_ids`     |     | uuid[] from `tags_list.industries`. |
| `region_ids`       |     | uuid[] from `tags_list.regions`. |
| `stage_ids`        |     | uuid[] from `tags_list.stages`. |
| `linkedin`         |     | URL. |
| `location`         |     | Free text. |

## Meeting (`crm_create_meeting`)

| Field        | Req | Notes |
| ------------ | --- | ----- |
| `company_id` | ✅  | uuid of an existing company. |
| `date`       | ✅  | YYYY-MM-DD. |
| `title`      | ✅  | |
| `notes`      |     | Free text. |
| `type_id`    |     | uuid from `tags_list.meetingTypes`. |

## Tag catalogs (`tags_list`)

Returns: `industries`, `regions`, `stages`, `types`, `statuses`, `meetingTypes` — each an
array of `{ id, name }`. Resolve free-text tag values to a catalog **name** first (see
`reference/verification-rules.md` for the alias rules), then use its `id`. If a value has no
catalog match, stage the event with the free text under `extracted` and let review decide.
