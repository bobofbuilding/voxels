select spaces.*,
       0 as x1,
       0 as y1,
       0 as z1,
       width as x2,
       height as y2,
       depth as z2,
       unlisted,
       '' as island,
       'The void' as suburb,
       'Nowhere near' as address,
       memoized_hash as hash,
       COALESCE(
         (SELECT row_to_json(sub) FROM (SELECT av.id, av.name, av.owner, av.created_at FROM avatars av WHERE lower(av.owner) = lower(spaces.owner) LIMIT 1) sub),
         to_json(spaces.owner)
       ) as owner
from spaces
where spaces.id = $1;