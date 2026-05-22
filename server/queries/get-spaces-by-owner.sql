select s.name,
       s.id,
       s.created_at,
       0 as x1,
       0 as y1,
       0 as z1,
       width as x2,
       height as y2,
       depth as z2,
       width,
       height,
       depth,
       unlisted,
       visits,
       COALESCE(
         (SELECT row_to_json(sub) FROM (SELECT av.id, av.name, av.owner, av.created_at FROM avatars av WHERE lower(av.owner) = lower(s.owner) LIMIT 1) sub),
         to_json(s.owner)
       ) as owner,
       json_array_length(null_if_invalid_string(s.content, s.id) -> 'features') as feature_count,
       count(*) OVER() AS pagination_count
from spaces s
where lower(s.owner) = lower($2)
order by coalesce(s.updated_at, '1900-01-01'::timestamp) desc limit
  100
offset coalesce($1 * 100, 0);
