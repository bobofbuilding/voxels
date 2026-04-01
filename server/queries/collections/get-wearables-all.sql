select id,
       token_id,
       name,
       description,
       collection_id,
       greatest(1, least(1024, issues)) as issues,
       author,
       hash
from wearables
where suppressed = false
order by created_at desc;