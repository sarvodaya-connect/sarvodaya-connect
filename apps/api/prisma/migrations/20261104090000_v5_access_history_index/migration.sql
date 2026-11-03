-- V5 PR 7: temporary district access history (DM04, M32) looks events up by action and grant.
CREATE INDEX "platform_audit_events_action_target_id_idx" ON "platform_audit_events"("action", "target_id");
