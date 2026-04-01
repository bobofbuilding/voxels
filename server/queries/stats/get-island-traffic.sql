select s.id,
       s.name,
       t.day,
       sum(visits) as   sum_visits,
       SUM(sum(visits)) OVER (PARTITION BY s.id ORDER BY day) AS cumul_visits, (100 * (sum(visits) - (LAG(sum(visits), 1) OVER (PARTITION BY s.id ORDER BY t.day ASC))) / (LAG(sum(visits), 1)OVER (PARTITION BY s.id ORDER BY t.day ASC))) ::float  as growth
from islands s
         left join properties p
                   on regexp_replace(lower(trim(coalesce(p.island, ''))), '\s+', '-', 'g') =
                      regexp_replace(lower(trim(s.name)), '\s+', '-', 'g')
         left join traffic t on p.id = parcel_id
where s.id = $1
group by s.id, s.name, t.day
ORDER BY
    day ASC, s.id ASC;
