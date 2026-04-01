select properties.id                              as id,
       y2 - y1                                    as height,
       address,
       suburbs.name                               as suburb,
       properties.island,
       properties.name                            as name,
       (select array_to_json(array_agg(row_to_json(t)))
        from (select wallet,
                     role
              from parcel_users
              where parcel_id = properties.id) t) as parcel_users,
       geometry_json                              as geometry,
       CAST(distance_to_center as double precision),
       CAST(distance_to_ocean as double precision),
       CAST(distance_to_closest_common as double precision),
       lower(properties.owner)                    as owner,
       avatars.name                               as owner_name,
       memoized_hash                              as hash,
       properties.x1,
       properties.x2,
       y1,
       lightmap_url,
       label,
       y2,
       visible,
       properties.z1,
       properties.z2
from properties
         left join suburbs on properties.suburb_id = suburbs.id
         left join avatars on lower(avatars.owner) = lower(properties.owner)
where minted = true limit
  $1;
