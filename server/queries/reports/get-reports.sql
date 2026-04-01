select *
from reports
where (extra ILIKE $1 OR reports.reason ILIKE $1)
  and ($5::text IS NULL OR $5::text = reports.type)
  and ($6::boolean IS NOT TRUE OR NOT $6::boolean = reports.resolved)
order by (CASE WHEN $4::boolean THEN reports.created_at END) ASC,
         (CASE WHEN NOT $4::boolean  THEN reports.created_at END) DESC limit
  $2
offset coalesce(($2::integer * $3::integer),0);
