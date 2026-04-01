select id,
       token_id,
       name,
       description,
       greatest(1, least(1024, issues)) as issues,
       collection_id,
       author,
       hash
from wearables
where suppressed = false
  and created_at >= NOW() - interval '6 months'
order by
    created_at desc;