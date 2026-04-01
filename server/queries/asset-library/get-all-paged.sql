select a.id,
       a.type,
       author,
       a.name,
       a.content,
       a.description,
       category, public, views, a.created_at, a.updated_at, image_url, has_script, has_unsafe_script
from
    asset_library a
where
    public = true
  and
    ((a.name ILIKE $1
   OR a.description ILIKE $1
   or a.author ILIKE $1))
  and
    ($6::text IS NULL
   OR $6::text = a.category)
  and
    ($7::text IS NULL
   OR $7::text = (a.content->0)::jsonb->>'type')
order by
    (CASE WHEN ($4::text = 'name' AND $5::boolean ) THEN a.name:: varchar END) ASC,
    (CASE WHEN ($4::text = 'name' AND NOT $5::boolean ) THEN a.name:: varchar END) DESC,
    (CASE WHEN ($4::text = 'created_at' AND $5::boolean ) THEN a.created_at END) ASC,
    (CASE WHEN ($4::text = 'created_at' AND NOT $5::boolean ) THEN a.created_at END) DESC,
    (CASE WHEN ($4::text = 'views' AND $5::boolean ) THEN a.views:: integer END) ASC,
    (CASE WHEN ($4::text = 'views' AND NOT $5::boolean ) THEN a.views:: integer END) DESC
    limit
    $2
offset coalesce(($2::integer * $3::integer),0);
