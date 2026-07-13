-- ============================================================
-- Feedback — mark-as-done (021)
-- ============================================================

alter table feedback add column done boolean not null default false;

create policy "admin update feedback" on feedback for update to authenticated
  using (is_admin()) with check (is_admin());
