select count(id),
       (select created_at from property_versions where parcel_id = $1 order by created_at asc limit 1) as start_date
from
    property_versions
where
    parcel_id = $1