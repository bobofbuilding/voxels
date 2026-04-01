select *
from property_versions
where parcel_id = $1
  and ($5::text is null OR created_at>= to_timestamp($5::bigint)::timestamp)
  and ($6::text is null OR created_at<= to_timestamp($6::bigint)::timestamp)
order by (CASE WHEN $4::boolean THEN property_versions.updated_at END) ASC,
         (CASE WHEN NOT $4::boolean  THEN property_versions.updated_at END) DESC limit
  $2
offset coalesce(($2::integer * $3::integer),0);
