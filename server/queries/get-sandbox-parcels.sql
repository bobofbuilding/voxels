select properties.id                                                      as id,
       y2 - y1                                                            as height,
       address,
       properties.name                                                    as name,
       geometry_json                                                      as geometry,
       CAST(distance_to_center as double precision),
       CAST(distance_to_ocean as double precision),
       CAST(distance_to_closest_common as double precision),
       (select name from suburbs where properties.suburb_id = suburbs.id) as suburb,
       lower(properties.owner)                                            as owner,
       avatars.name                                                       as owner_name
from properties
         left join
     avatars on avatars.owner = lower(properties.owner)
where sandbox = true
order by random() limit
  10;
