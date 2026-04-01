select s.id,
       s.name,
       s.position_json as position,
       array_to_json(array_agg(p)) as parcels
from islands s
         left join properties p
                   on regexp_replace(lower(trim(coalesce(p.island, ''))), '\s+', '-', 'g') =
                      regexp_replace(lower(trim(s.name)), '\s+', '-', 'g')
where regexp_replace(lower(s.name), '\s+', '-', 'g') = $1::text
group by s.id, s.name, s.position_json;
