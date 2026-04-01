select womps.id,
       womps.author,
       womps.content,
       womps.parcel_id,
       womps.space_id,
       womps.image_url,
       womps.coords,
       womps.created_at,
       womps.updated_at,
       properties.name    as parcel_name,
       properties.address as parcel_address,
       properties.island  as parcel_island,
       spaces.name        as space_name,
       avatars.name       as author_name
from womps
         left join
     properties on coalesce(womps.parcel_id, 0)::integer = properties.id
left join
  spaces
on womps.space_id::uuid = spaces.id
    left join
    avatars on lower (womps.author) = lower (avatars.owner)
where
    womps.id = $1
    limit
    1;