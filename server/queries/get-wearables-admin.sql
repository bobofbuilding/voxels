select id,
       name,
       description,
       greatest(1, least(1024, issues)) as issues,
       author,
       hash
from wearables
where token_id is null
  and suppressed = false
order by created_at desc;