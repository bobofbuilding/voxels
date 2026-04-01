select c.id,
       c.name,
       c.description,
       c.image_url,
       c.owner,
       a.name as owner_name,
       address,
       slug,
       c.type,
       chainid,
       c.settings,
       suppressed,
       discontinued,
       collectibles_type,
       custom_attributes_names,
       rejected_at,
       c.created_at
from collections c
         left join
     avatars a
     on lower(a.owner) = lower(c.owner)
where c.chainid = coalesce($1, 1)
  AND lower(c.address) = lower($2) limit
  1;