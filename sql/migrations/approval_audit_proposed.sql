-- STAGE B ONLY. Requires explicit owner approval; not applied by the app.
-- Nullable JSON preserves existing rows; no backfill or invented old actors.
ALTER TABLE `prepagent-hack.prepagent.job_sheets`
ADD COLUMN IF NOT EXISTS approval_audit_json JSON;
