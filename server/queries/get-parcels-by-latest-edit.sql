select p.id,
       y2 - y1                          as height,
       p.token,
       p.name,
       p.description,
       address,
       p.geometry_json                  as geometry,

       p.x1,
       p.x2,
       p.z1,
       p.z2,
       pv.updated_at                    as updated_at,
       lower(p.owner)                   as owner
from (select parcel_id,
             max(updated_at) as updated_at,
             max(id)         as id
      from property_versions
      group by parcel_id
      order by id desc) pv
         left join
     properties p
     on
         p.id = pv.parcel_id
order by pv.updated_at desc limit coalesce($1,5);
