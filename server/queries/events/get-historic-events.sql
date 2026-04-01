SELECT parcel_events.*,
       (SELECT name FROM avatars WHERE lower(avatars.owner) = lower(parcel_events.author)) AS author_name,
       (SELECT name FROM suburbs WHERE properties.suburb_id = suburbs.id)                  AS parcel_suburb,
       properties.name                                                                     AS parcel_name,
       properties.address                                                                  AS parcel_address,
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
     properties ON properties.id = parcel_events.parcel_id
WHERE parcel_events.expires_at < NOW()
ORDER BY parcel_events.expires_at DESC LIMIT
  128;
