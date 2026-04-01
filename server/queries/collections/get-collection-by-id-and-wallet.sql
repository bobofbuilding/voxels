select collections.id,
       name,
       description,
       image_url,
       owner,
       address,
       slug,
       type,
       chainid,
       settings,
       suppressed,
       discontinued,
       rejected_at,
       created_at
from collections
where lower(collections.owner) = lower($2)
  and collections.id = $1