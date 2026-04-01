-- $1 is the number of 1/4 of days since CV started recording traffic
-- $2 is the number of days to obtain traffic
select p.id,
       name,
       address,
       description,
       label,
       sum(visits) as visits
from traffic
         inner join
     properties p on p.id = parcel_id
where ($1) - (4 * ($2)::integer) < traffic.day
  and p.suburb_id = $3
group by p.id, name, address, description, parcel_id
order by sum(visits) desc;