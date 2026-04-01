select properties.id                             as id,
       height,
       address,
       suburbs.name                              as suburb,
       properties.island,
       properties.name                           as name,
       geometry_json                             as geometry,
       properties.content                        as content,
       properties.x1,
       properties.x2,
       y1,
       y2,
       properties.z1,
       properties.z2
from properties
         left join suburbs on suburbs.id = properties.suburb_id
where minted = true
order by ID asc;
