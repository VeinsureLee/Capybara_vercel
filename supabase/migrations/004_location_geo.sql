-- ------------------------------------------------
-- 004: 地点地理信息 + 图片扩展
-- ------------------------------------------------

alter table travel_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists image_url text,
  add column if not exists gallery_urls text[] default '{}';

-- 经纬度索引（用于地图查询）
create index if not exists idx_travel_locations_geo
  on travel_locations(latitude, longitude)
  where latitude is not null and longitude is not null;
