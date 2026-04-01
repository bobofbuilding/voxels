select properties.id                             as id,
       y2 - y1                                   as height,
       address,
       properties.name,
       properties.owner,
       avatars.name                              as owner_name,
       geometry_json                             as geometry,
       CAST(distance_to_center as double precision),
       CAST(distance_to_ocean as double precision),
       CAST(distance_to_closest_common as double precision),
       suburbs.name                              as suburb,
       properties.x1,
       properties.x2,
       y1,
       y2 - y1                                   as y2,
       properties.z1,
       properties.z2,
       properties.island                         as island
from properties
         left join avatars on lower(avatars.owner) = lower(properties.owner)
         left join suburbs on suburbs.id = properties.suburb_id
where $1::text ILIKE 
any(
  ARRAY[
    (select array_agg(parcel_users.wallet) 
    from parcel_users 
    where parcel_users.parcel_id = properties.id 
    and parcel_users.role<>'excluded'
    )
    ]
    );