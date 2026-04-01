select *
from property_versions
where parcel_id = $1
  and id = $2
order by created_at desc;
