SELECT t.id,
       t.parcel_id,
       t.visits,
       p.id                             as pid,
       p.name                           as name,
       p.description                    as description,
       p.address                        as address,
       p.geometry_json                  as geometry,

       p.x1,
       p.x2,
       p.z1,
       p.z2
FROM traffic t
         left join
     properties p
     on t.parcel_id = p.id
ORDER BY t.id DESC limit 12

