with attchmnts as (select json_array_elements(c.attachments) as a,
                          avatars.owner                      as o
                   from avatars
                            left JOIN
                        costumes c
                        on
                            costume_id = c.id
                   where c.attachments is not null
                     and c.attachments
    ::text <> 'null'
    )
   , wearables_and_owners as (
SELECT
    (a->>'wearable_id'):: integer as wearable_id, o, w.name as name, w.author as author, w.token_id as id, (a->>'bone')::text as bone
FROM attchmnts
    left JOIN
    wearables w
on
    (a->>'wearable_id'):: integer = w.token_id
    and (case
    when (a->>'collection_id') is not null then (a->>'collection_id'):: integer
    ELSE 1
    End ) = w.collection_id
where w.token_id is not null
  and lower (w.author) = lower ($1)
    )

select count(wao.wearable_id) as num_worn,
       count(DISTINCT o)      as num_worn_distinct,
       wao.id                 as token_id,
       wao.name               as name
from wearables_and_owners wao
GROUP BY wao.name, wao.id
ORDER BY num_worn_distinct DESC, num_worn desc;
