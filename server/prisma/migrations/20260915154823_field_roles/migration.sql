-- Add "Admin Lapangan" + "Pekerja Lapangan" roles (Work Order Phase 4 decision, 2026-07-05).
-- Admin Lapangan: field supervisor who delegates Work Orders to non-tech-savvy
-- field workers (Maintenance/Housekeeping). Cross-divisional role (divisionId
-- NULL) — actual division scoping happens via each User's own divisionId.
-- Pekerja Lapangan: field worker created as a plain User (needed for HRIS
-- self-service: attendance/leave), but locked out of Task/Work Order/etc.

INSERT INTO "roles" ("id","name","slug","color","level","divisionId","updatedAt") VALUES
  (gen_random_uuid(),'Admin Lapangan','ADMIN_LAPANGAN','#ea580c',5,NULL,NOW()),
  (gen_random_uuid(),'Pekerja Lapangan','FIELD_WORKER','#64748b',6,NULL,NOW());

INSERT INTO "role_permissions" ("id","roleId","permissions","updatedAt")
SELECT gen_random_uuid(), id,
  '{"work_order":{"view":"division","create":true,"edit":"division","delete":"none","canBeAssignee":true}}'::jsonb,
  NOW()
FROM "roles" WHERE slug = 'ADMIN_LAPANGAN';

INSERT INTO "role_permissions" ("id","roleId","permissions","updatedAt")
SELECT gen_random_uuid(), id,
  '{
    "task":       {"view":"none","create":false,"edit":"none","delete":"none","viewPrivate":false,"editAssignedFully":false},
    "work_order": {"view":"none","create":false,"edit":"none","delete":"none","canBeAssignee":true},
    "bulletin":   {"view":false,"create":false,"audienceScope":"none","edit":"none","delete":"none"},
    "db_link":    {"view":"none","addLink":false,"manageFolder":false,"shareFolder":false},
    "note":       {"view":"none","create":false,"edit":"none","delete":"none"},
    "analytics":  {"view":"none"},
    "audit_log":  {"view":"none"},
    "inventory":  {"view":"none","create":false,"edit":"none","delete":"none","approvePurchase":false,"approveDisposal":false,"approveTransfer":false}
  }'::jsonb,
  NOW()
FROM "roles" WHERE slug = 'FIELD_WORKER';
