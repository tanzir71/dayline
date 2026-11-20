# Data model

One local database per device: IndexedDB via Dexie. There is no server copy. IDs are UUIDv7 strings generated on the device. Times are ISO 8601 strings with offset (`2026-11-20T21:40:00+06:00`), so a day line is always shown in the time zone where it happened. Every table has `created_at`, `updated_at` and `deleted_at` (soft delete, so a mistaken delete can be undone and backups stay consistent).

## Entities

| Table | Purpose | Key columns | From |
| --- | --- | --- | --- |
| `child` | A child the family cares for | `name`, `birth_month` (YYYY-MM), `language` (`bn`/`en`), `photo` (small blob, optional), `hard_moment_word` | M1 |
| `profile_section` | "About the child" answers | `child_id`, `section` (communication, distress_signs, calms, avoid, food, sleep, other), `body` (Markdown), `sort` | M1 |
| `contact` | People to call | `child_id`, `name`, `role` (parent, grandparent, sitter, teacher, doctor, therapist, other), `phone`, `notes` | M1 |
| `noter` | Names for "noted by" (Amma, Abbu, Nanu, Ms. Akter) | `name`, `role` | M1 |
| `prescriber` | Doctors who prescribe or advise | `child_id`, `name`, `specialty`, `clinic`, `phone` | M1 |
| `medicine` | A medicine the child takes | `child_id`, `generic_name`, `brand_name`, `form`, `strength_text`, `prescriber_id`, `label_key`, `active` | M1 |
| `medicine_schedule` | When to give it | `medicine_id`, `times` (array of `HH:MM`), `days` (RRULE or null for daily), `amount_text`, `with_food`, `starts_on`, `ends_on` | M1 |
| `stock` | Refill tracking | `medicine_id`, `units_left`, `units_per_dose`, `warn_at_days` | M1 |
| `event` | Anything on the day line | `child_id`, `kind` (see below), `started_at`, `ended_at`, `size` (1–5 or null), `place`, `data` (per kind), `note`, `noted_by`, `source` (tap, help_now, schedule, show_mode, check_in, import) | M1 |
| `event_tag` | Just-before and what-helped tags | `event_id`, `type` (before, helped), `tag` | M1 |
| `playbook_item` | What helps, per situation | `child_id`, `situation` (hard_moment, haircut, travel, sleep, food, other), `text`, `guide_slug`, `sort`, `helped_count` | M1 |
| `share_record` | What was shown or sent, for "last sent to Dr. Rahman on 4 Dec" | `child_id`, `what` (brief, visit_report, passport, backup), `how` (show, pdf, print), `to_text`, `language`, `at` | M1 |
| `visit` | A doctor or therapy visit | `child_id`, `prescriber_id`, `scheduled_at`, `prep` (answers), `questions` (array), `report_period_start` | M2 |
| `change` | A medicine, dose, therapy, diet, school or routine change | `child_id`, `type`, `medicine_id` (nullable), `summary`, `reason`, `decided_by`, `effective_on`, `review_on`, `outcome` (kept, changed, stopped, undecided) | M2 |
| `check_in` | Weekly three-tap check | `child_id`, `week_start`, `sleep`, `mood`, `hard_moments` (each: less, same, more), `note` | M2 |
| `insight_feedback` | "Makes sense / Not this" on a pattern | `child_id`, `pattern_key`, `verdict`, `note` | M2 |
| `settings` | App settings | `key`, `value` (language, emergency number, reminder times, last backup, install-prompt state) | M1 |

### `event.kind` and `data`

| kind | `data` example |
| --- | --- |
| `sleep` | `{ "quality": "restless", "night_wakings": 2 }` (started_at = bedtime, ended_at = wake) |
| `dose` | `{ "medicine_id": "…", "schedule_time": "08:00", "status": "given" \| "late" \| "missed" \| "refused", "amount_text": "0.5 mg" }` |
| `food` | `{ "meal": "lunch", "ate": "some", "gut": "constipated" \| "loose" \| null }` |
| `hard_moment` | `{ "parent_word": "meltdown", "from_help_now": true }` plus `before` and `helped` tags |
| `win` | `{ "text": "Said 'water' on his own" }` |
| `school` | `{ "summary": "Calm morning, upset at lunch" }` with `noted_by` = the teacher's name |
| `health` | `{ "symptom": "fever", "value": "38.2" }` |
| `note` | `{}` (just `note`) |

Hard moments use the family's own word in the UI (`child.hard_moment_word`).

## Derived (never stored as truth)

- **Day line:** planned items (from `medicine_schedule`, `visit`) merged with `event` rows for the day.
- **Brief:** built from `profile_section`, `contact`, `playbook_item` and today's events at the moment it's shown or turned into a PDF.
- **Daily table** for patterns: one row per child per day with sleep hours, dose adherence, hard-moment count and size, gut flags, tags; built in a worker.
- **Change review:** windows before and after `change.effective_on`, with counts, coverage and overlapping changes.

## Migrations and backup

- Dexie versions with upgrade functions in `src/data/migrations/`, forward-only, each with a test.
- Backup file: `dayline-backup-v1.json` = `{ version, exported_at, tables: { child: [...], ... } }`. Importing runs migrations on the imported data, then replaces the local tables after a confirm. CSV per table for spreadsheets.
