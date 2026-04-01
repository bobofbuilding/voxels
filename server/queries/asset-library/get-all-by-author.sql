select a.id,
       a.type,
       author,
       a.name,
       a.description,
       category,
       image_url, public, views, a.created_at, a.updated_at, has_script, has_unsafe_script, avatars.name as author_name
from
    asset_library a
    left join
    avatars
on
    lower (avatars.owner) = lower (a.author)
where lower ($4) = lower (a.author)
  and
    (NOT $5::boolean
   or public = NOT $5::boolean)
  and
    ((a.name ILIKE $1
   OR a.description ILIKE $1))
  and
    ($8::text IS NULL
   OR $8::text = a.category)
  and
    ($9::text IS NULL
   OR $9::text = (a.content-
    >0)::jsonb->>'type')
order by
    (CASE WHEN ($6::text = 'name' AND $7::boolean ) THEN a.name:: varchar END) ASC,
    (CASE WHEN ($6::text = 'name' AND NOT $7::boolean ) THEN a.name:: varchar END) DESC,
    (CASE WHEN ($6::text = 'created_at' AND $7::boolean ) THEN a.created_at END) ASC,
    (CASE WHEN ($6::text = 'created_at' AND NOT $7::boolean ) THEN a.created_at END) DESC,
    (CASE WHEN ($6::text = 'views' AND $7::boolean ) THEN a.views:: varchar END) ASC,
    (CASE WHEN ($6::text = 'views' AND NOT $7::boolean ) THEN a.views:: varchar END) DESC
    limit
    $2
offset coalesce(($2::integer * $3::integer),0);
