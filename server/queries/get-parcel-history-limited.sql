select *
from property_versions
where parcel_id = $1
order by updated_at desc limit
  COALESCE(($2)::integer,20);
