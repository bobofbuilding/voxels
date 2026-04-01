select womps.id,
       womps.author,
       womps.content,
       womps.parcel_id,
       womps.space_id,
       womps.coords,
       womps.image_url,
       womps.created_at,
       womps.updated_at,
       properties.name    as parcel_name,
       spaces.name        as space_name,
       properties.address as parcel_address,
       properties.island  as parcel_island,
       avatars.name       as author_name
from womps
         left join
     properties on coalesce(womps.parcel_id::integer, 0) = properties.id
         left join
     spaces on womps.space_id::uuid = spaces.id
left join
  avatars
on lower (womps.author) = lower (avatars.owner)
where
    womps.author = $1
  and womps.kind != 'report'
order by
    id desc
    limit
    $2;