select a.id,
       a.type,
       author,
       a.name,
       a.description,
       category,
       content, public, views, a.created_at, a.updated_at, image_url, has_script, has_unsafe_script, avatars.name as author_name
from
    asset_library a
    left join
    avatars
on
    lower (avatars.owner) = lower (a.author)
where
    a.id = $1