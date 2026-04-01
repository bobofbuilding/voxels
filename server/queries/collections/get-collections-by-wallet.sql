with extra as (select id,
                      (select count(id)
                       from wearables
                       where token_id is not null
                         and collection_id = collections.id) as total_wearables,
                      (select count(distinct author)
                       from wearables
                       where token_id is not null
                         and collection_id = collections.id) as total_authors
               from collections
               group by collections.id)

select collections.id,
       name,
       description,
       collections.image_url,
       owner,
       address,
       slug,
       type,
       extra.total_wearables as total_wearables,
       extra.total_authors   as total_authors,
       chainid,
       settings,
       suppressed,
       discontinued,
       rejected_at,
       collections.created_at
from collections
         left join
     extra
     on collections.id = extra.id
where lower(collections.owner) = lower($1)
  and (collections.id is not null)