select womps.id,
       womps.author,
       womps.content,
       womps.parcel_id,
       womps.space_id,
       womps.image_url,
       womps.coords,
       womps.created_at,
       womps.updated_at,
       image IS NOT NULL  as image_supplied,
       properties.name    as parcel_name,
       properties.address as parcel_address,
       properties.island  as parcel_island,
       avatars.name       as author_name
from womps
         left join
     properties on womps.parcel_id = properties.id
         left join
     avatars on lower(womps.author) = lower(avatars.owner)
where womps.parcel_id = $1
  and womps.kind != 'report'
order by
    id desc
    limit
    $2;