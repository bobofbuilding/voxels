select (select count(a.id)
        from asset_library a
        where
    public = true
    and
     ((a.name ILIKE $1 OR a.description ILIKE $1 or a.author ILIKE $1))
    and
     ($2::text IS NULL OR $2::text = a.category)
    and
     ($3::text IS NULL OR $3::text = (a.content->0)::jsonb->>'type')
    ):: integer as total_all
     , (
select
    count (a.id)
from
    asset_library a
where
    type <>'script'
  and
    public = true
  and
    ((a.name ILIKE $1
   OR a.description ILIKE $1
   or a.author ILIKE $1))
  and
    ($2::text IS NULL
   OR $2::text = a.category)
  and
    ($3::text IS NULL
   OR $3::text = (a.content->0)::jsonb->>'type')
    ):: integer as total_features
    , (
select
    count (a.id)
from
    asset_library a
where
    type ='script'
  and
    public = true
  and
    ((a.name ILIKE $1
   OR a.description ILIKE $1
   or a.author ILIKE $1))
  and
    ($2::text IS NULL
   OR $2::text = a.category)
  and
    ($3::text IS NULL
   OR $3::text = (a.content->0)::jsonb->>'type')
    ):: integer as total_scripts
    , (
select
    count (a.id)
from
    asset_library a
where
    lower ($4) = lower (a.author)
  and
    (NOT $5::boolean
   or public = NOT $5::boolean)
  and
    ((a.name ILIKE $1
   OR a.description ILIKE $1
   or a.author ILIKE $1))
  and
    ($2::text IS NULL
   OR $2::text = a.category)
  and
    ($3::text IS NULL
   OR $3::text = (a.content->0)::jsonb->>'type')
    ):: integer as total_authored;
