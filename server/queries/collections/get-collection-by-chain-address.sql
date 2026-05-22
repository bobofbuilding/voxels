select c.id,
       c.name,
       c.description,
       c.image_url,
       COALESCE(
         (SELECT row_to_json(sub) FROM (SELECT av.id, av.name, av.owner, av.created_at FROM avatars av WHERE lower(av.owner) = lower(c.owner) LIMIT 1) sub),
         to_json(c.owner)
       ) as owner,
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
       c.created_at,
       (select count(w.id)
        from wearables w
        where w.collection_id = c.id
          and w.token_id is not null) as total,
       (select count(distinct w.author)
        from wearables w
        where w.collection_id = c.id
          and w.token_id is not null) as authors
from collections c
where c.chainid = coalesce($1, 1)
  AND lower(c.address) = lower($2) limit
  1;