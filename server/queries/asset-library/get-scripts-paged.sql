select a.id,
       a.type,
       author,
       a.name,
       a.description,
       image_url,
       category, public, views, a.created_at, a.updated_at, has_script, has_unsafe_script, avatars.name as author_name
from
    asset_library a
    left join
    avatars
on
    lower (avatars.owner) = lower (a.author)
where a.type = 'script'
  and public = true
  and
    ((a.name ILIKE $1
   OR a.description ILIKE $1
   or a.author ILIKE $1))
order by
    (CASE WHEN ($4::text = 'name' AND $5::boolean ) THEN a.name:: varchar END) ASC,
    (CASE WHEN ($4::text = 'name' AND NOT $5::boolean ) THEN a.name:: varchar END) DESC,
    (CASE WHEN ($4::text = 'created_at' AND $5::boolean ) THEN a.created_at END) ASC,
    (CASE WHEN ($4::text = 'created_at' AND NOT $5::boolean ) THEN a.created_at END) DESC,
    (CASE WHEN ($4::text = 'views' AND $5::boolean ) THEN a.views:: varchar END) ASC,
    (CASE WHEN ($4::text = 'views' AND NOT $5::boolean ) THEN a.views:: varchar END) DESC
    limit
    $2
offset coalesce(($2::integer * $3::integer),0);