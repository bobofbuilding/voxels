SELECT parcel_events.*,
       (SELECT name FROM avatars WHERE lower(avatars.owner) = lower(parcel_events.author)) AS author_name
FROM parcel_events
WHERE parcel_events.parcel_id = $1
ORDER BY parcel_events.id DESC LIMIT 1;

