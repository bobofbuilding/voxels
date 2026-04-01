select avatars.id,
       avatars.owner,
       avatars.name,
       array_to_json(array_agg(row(p.id, p.name, p.address))) as parcels
from avatars
         left join
     properties p
     on
         lower(p.owner) = avatars.owner
group by avatars.id, avatars.owner, avatars.name
order by avatars.name limit
  $1
offset $2;