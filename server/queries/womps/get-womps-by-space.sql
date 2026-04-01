select womps.id,
       womps.author,
       womps.content,
       womps.parcel_id,
       womps.space_id,
       womps.image_url,
       womps.coords,
       womps.created_at,
       womps.updated_at,
       image IS NOT NULL as image_supplied,
       spaces.name       as parcel_name,
       'The void'        as parcel_address,
       avatars.name      as author_name
from womps
         left join
     spaces on womps.space_id = spaces.id
         left join
     avatars on lower(womps.author) = lower(avatars.owner)
where womps.space_id = $1
  and womps.kind != 'report'
order by
    id desc
    limit
    $2;