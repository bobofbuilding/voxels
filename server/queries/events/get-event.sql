SELECT parcel_events.*,
       (SELECT name FROM avatars WHERE lower(avatars.owner) = lower(parcel_events.author)) AS author_name,
       (SELECT name FROM avatars WHERE lower(avatars.owner) = lower(properties.owner))     AS parcel_owner_name,
       properties.address                                                                  AS parcel_address,
       properties.description                                                              AS parcel_description,
       properties.geometry_json                                                            AS geometry,
       properties.x1                                                                       AS x1,
       properties.x2                                                                       AS x2,
       properties.y1,
       properties.y2,
       properties.y2                                                                       AS height,
       properties.z1                                                                       AS z1,
       properties.z2                                                                       AS z2
FROM parcel_events
         LEFT JOIN
     properties ON parcel_events.parcel_id = properties.id
WHERE parcel_events.id = $1
ORDER BY parcel_events.id DESC LIMIT 1;
