select spaces.*,
       0              as x1,
       0              as y1,
       0              as z1,
       width          as x2,
       height         as y2,
       depth          as z2,
       unlisted,
       ''             as island,
       'The void'     as suburb,
       'Nowhere near' as address,
       memoized_hash  as hash,
       a.name         as owner_name
from spaces
         left join
     avatars a
     on
         lower(a.owner) = lower(spaces.owner)
where spaces.id = $1;