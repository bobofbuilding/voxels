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
   , wearables_info as (
SELECT
    (a->>'wearable_id'):: integer as wearable_id, w.collection_id as collection_id, o, w.name as name, (a->>'bone')::text as bone
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
    )

select count(wai.wearable_id) as num_worn,
       wai.bone               as bone,
       count(DISTINCT o)      as num_worn_distinct
from wearables_info wai
where wai.wearable_id = $1
  and ($2::integer IS NULL OR wai.collection_id = $2::integer)
group BY wai.bone
ORDER BY num_worn DESC limit
 1;