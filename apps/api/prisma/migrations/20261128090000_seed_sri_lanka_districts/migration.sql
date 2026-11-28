-- Use Department of Census and Statistics district codes for new reference rows.
-- Match existing districts by name to retain their UUIDs, codes and assignments.
INSERT INTO "districts" ("id", "code", "name_en", "province", "updated_at")
SELECT gen_random_uuid(), district.code, district.name, district.province, CURRENT_TIMESTAMP
FROM (VALUES
  ('11', 'Colombo', 'Western Province'),
  ('12', 'Gampaha', 'Western Province'),
  ('13', 'Kalutara', 'Western Province'),
  ('21', 'Kandy', 'Central Province'),
  ('22', 'Matale', 'Central Province'),
  ('23', 'Nuwara Eliya', 'Central Province'),
  ('31', 'Galle', 'Southern Province'),
  ('32', 'Matara', 'Southern Province'),
  ('33', 'Hambantota', 'Southern Province'),
  ('41', 'Jaffna', 'Northern Province'),
  ('42', 'Mannar', 'Northern Province'),
  ('43', 'Vavuniya', 'Northern Province'),
  ('44', 'Mullaitivu', 'Northern Province'),
  ('45', 'Kilinochchi', 'Northern Province'),
  ('51', 'Batticaloa', 'Eastern Province'),
  ('52', 'Ampara', 'Eastern Province'),
  ('53', 'Trincomalee', 'Eastern Province'),
  ('61', 'Kurunegala', 'North Western Province'),
  ('62', 'Puttalam', 'North Western Province'),
  ('71', 'Anuradhapura', 'North Central Province'),
  ('72', 'Polonnaruwa', 'North Central Province'),
  ('81', 'Badulla', 'Uva Province'),
  ('82', 'Monaragala', 'Uva Province'),
  ('91', 'Ratnapura', 'Sabaragamuwa Province'),
  ('92', 'Kegalle', 'Sabaragamuwa Province')
) AS district(code, name, province)
ON CONFLICT ("name_en") DO UPDATE
SET "province" = EXCLUDED."province", "updated_at" = EXCLUDED."updated_at"
WHERE "districts"."province" IS NULL;
