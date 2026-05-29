-- PostgreSQL: 移除 GPLv3 协议类型

-- ========== 1. 修改 skins 表 ==========
ALTER TABLE skins DROP CONSTRAINT IF EXISTS skins_license_type_check;
ALTER TABLE skins ADD CONSTRAINT skins_license_type_check
  CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom'));

-- ========== 2. 修改 capes 表 ==========
ALTER TABLE capes DROP CONSTRAINT IF EXISTS capes_license_type_check;
ALTER TABLE capes ADD CONSTRAINT capes_license_type_check
  CHECK (license_type IN ('CC0_1.0', 'CC_BY_3.0', 'CC_BY_4.0', 'CC_BY-SA_3.0', 'CC_BY-SA_4.0', 'CC_BY-NC_3.0', 'CC_BY-NC_4.0', 'ARR', 'AI_CC0', 'Custom'));
