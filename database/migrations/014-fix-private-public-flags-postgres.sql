-- PostgreSQL: 修复历史数据——审核通过曾无条件将 is_public 置 TRUE，导致「私密」皮肤/披风被误公开。
-- 将 permission_level='private' 但被误标公开的记录纠正回私密；并修正 is_downloadable 与 permission_level 不一致的情况。

-- 私密：强制不公开、不可下载
UPDATE skins SET is_public = FALSE, is_downloadable = FALSE WHERE permission_level = 'private';
UPDATE capes SET is_public = FALSE, is_downloadable = FALSE WHERE permission_level = 'private';

-- public_no_download：公开但不可下载
UPDATE skins SET is_public = TRUE, is_downloadable = FALSE WHERE permission_level = 'public_no_download';
UPDATE capes SET is_public = TRUE, is_downloadable = FALSE WHERE permission_level = 'public_no_download';

-- public_downloadable：公开且可下载
UPDATE skins SET is_public = TRUE, is_downloadable = TRUE WHERE permission_level = 'public_downloadable';
UPDATE capes SET is_public = TRUE, is_downloadable = TRUE WHERE permission_level = 'public_downloadable';
