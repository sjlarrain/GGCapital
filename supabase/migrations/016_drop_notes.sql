-- ============================================================
-- ROLL BACK 015_notes.sql
-- The standalone Quick Notes feature is being folded into a
-- generalized interaction_logs instead (see 017_generalize_interaction_logs.sql).
-- ============================================================

drop policy if exists "note-files public read" on storage.objects;
drop policy if exists "note-files auth insert"  on storage.objects;
drop policy if exists "note-files auth update"  on storage.objects;
drop policy if exists "note-files auth delete"  on storage.objects;

-- NOTE: storage.buckets can't be deleted via plain SQL — Supabase's
-- storage.protect_delete() trigger blocks direct DELETEs on it to avoid
-- orphaning objects. Remove the empty 'note-files' bucket manually via
-- the Dashboard (Storage tab) or the Storage API after this migration runs.

drop table if exists notes;
