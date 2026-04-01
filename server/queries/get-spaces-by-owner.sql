select s.name,
       s.id,
       s.created_at,
       0                                                                         as x1,
       0                                                                         as y1,
       0                                                                         as z1,
       width                                                                     as x2,
       height                                                                    as y2,
       depth                                                                     as z2,
       width,
       height,
       depth,
       unlisted,
       visits,
       a.name                                                                    as owner_name,
       json_array_length(null_if_invalid_string(s.content, s.id) -> 'features') as feature_count,
       count(*)                                                                     OVER() AS pagination_count
from spaces s
         left join
     avatars a
     on
         lower(a.owner) = lower(s.owner)
where lower(s.owner) = lower($2)
order by coalesce(s.updated_at, '1900-01-01'::timestamp) desc limit
  100
offset coalesce($1 * 100, 0);
