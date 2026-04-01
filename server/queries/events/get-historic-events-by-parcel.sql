SELECT parcel_events.*,
       properties.id                                                                       AS parcel_id,
       (SELECT name FROM avatars WHERE lower(avatars.owner) = lower(parcel_events.author)) AS author_name
FROM parcel_events
         LEFT JOIN
     properties ON properties.id = parcel_events.parcel_id
WHERE parcel_events.parcel_id = $1
  AND parcel_events.expires_at < NOW()
ORDER BY parcel_events.expires_at DESC LIMIT 6;
