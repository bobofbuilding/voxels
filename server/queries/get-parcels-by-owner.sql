select properties.id,
       y2 - y1                                                                                                                          as height,
       address,
       name,
       kind,
       geometry_json                                                                                                                    as geometry,
       CAST(distance_to_center as double precision),
       CAST(distance_to_closest_common as double precision),
       CAST(distance_to_ocean as double precision),

       properties.x1,
       properties.x2,
       y1,
       y2 - y1                                                                                                                          as y2,
       properties.z1,
       properties.z2,

       (select name from suburbs where properties.suburb_id = suburbs.id)                                                               as suburb,
       properties.island,

       (select array_to_json(array_agg(row_to_json(t)))
        from (select wallet, role from parcel_users where parcel_id = properties.id) t)                                                 as parcel_users,
       label,
       description,
       bake,
       json_build_object('features', (content ->>'features')::json)                                                                     as content,
       (SELECT json_agg(row_to_json(emojis))
        from (select count(eb.id) as total,
                     eb.emoji     as emoji
              from emoji_badges eb
              WHERE eb.emojiable_type = 'parcels'
                AND eb.emojiable_id = properties.id::text AND eb.expires_at> NOW()
              GROUP by
                  emoji
              order by
                  total
                  desc) as emojis)                                                                                                      as emoji_list,
       lower(owner)                                                                                                                     as owner
from properties
where lower(owner) = lower($1)
  AND minted = true
  and is_common <> true
order by ID asc;