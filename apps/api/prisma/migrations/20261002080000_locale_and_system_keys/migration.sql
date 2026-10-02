-- i18n (design-doc D12)
--   users.locale          — UI language, synced across the user's devices
--   categories.system_key — stable id of a system category; the web translates its name
-- Expand-only change: new nullable/defaulted columns, so the previous api image keeps
-- working against this schema (rollback-safe, docs/cicd.md).

ALTER TABLE "users"
  ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'th';
ALTER TABLE "users"
  ADD CONSTRAINT "chk_users_locale" CHECK ("locale" IN ('th', 'en', 'lo'));

ALTER TABLE "categories"
  ADD COLUMN "system_key" VARCHAR(50);
CREATE UNIQUE INDEX "uq_categories_system_key" ON "categories" ("system_key");
-- Only system categories (user_id IS NULL) have a key.
ALTER TABLE "categories"
  ADD CONSTRAINT "chk_categories_system_key" CHECK ("system_key" IS NULL OR "user_id" IS NULL);

-- Backfill the system categories that already exist (seeded by name before this column).
-- Matched by name + type + depth; "อื่นๆ" exists once per type. New databases get the keys
-- from prisma/reference-data.ts instead (this UPDATE then matches nothing).
UPDATE "categories" AS c
SET "system_key" = v.key
FROM (
  VALUES
    ('salary',        'เงินเดือน',      'income',  false),
    ('freelance',     'ฟรีแลนซ์',       'income',  false),
    ('gift',          'ของขวัญ',        'income',  false),
    ('incomeOther',   'อื่นๆ',          'income',  false),
    ('food',          'อาหาร',          'expense', false),
    ('coffee',        'กาแฟ',           'expense', true),
    ('travel',        'เดินทาง',        'expense', false),
    ('housing',       'ที่พัก',         'expense', false),
    ('bills',         'บิล/ค่าน้ำไฟ',   'expense', false),
    ('shopping',      'ช้อปปิ้ง',       'expense', false),
    ('health',        'สุขภาพ',         'expense', false),
    ('entertainment', 'บันเทิง',        'expense', false),
    ('education',     'การศึกษา',       'expense', false),
    ('expenseOther',  'อื่นๆ',          'expense', false)
) AS v(key, name, type, is_child)
WHERE c."user_id" IS NULL
  AND c."name" = v.name
  AND c."type" = v.type
  AND (c."parent_id" IS NOT NULL) = v.is_child;
