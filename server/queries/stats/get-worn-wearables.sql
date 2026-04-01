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
    (a->>'wearable_id'):: integer as wearable_id, o, w.name as name, w.author as author, w.issues as issues, w.token_id as id, w.collection_id as collection_id, w.id as token_id, (a->>'bone')::text as bone
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

select *
from (select count(wao.wearable_id)                                                           as num_worn,
             count(DISTINCT o)                                                                as num_worn_distinct,
             wao.id                                                                           as token_id,
             wao.token_id                                                                     as id,
             wao.collection_id                                                                as collection_id,
             wao.name                                                                         as name,
             wao.issues                                                                       as issues,
             c.address                                                                        as collection_address,
             c.chainid                                                                        as chain_id,
             CASE
                 WHEN issues > 0 and issues < 10 THEN 'legendary'
                 WHEN issues >= 10 and issues < 100 THEN 'epic'
                 WHEN issues >= 100 and issues < 1000 THEN 'rare'
                 ELSE 'common'
                 END                                                                          AS rarity,
             lower(wao.author)                                                                as author,
             lower((select name from avatars where lower(avatars.owner) = lower(wao.author))) as author_name
      FROM wearables_and_owners wao
               inner JOIN
           collections c
           on
               c.id = wao.collection_id
      GROUP BY wao.name, wao.id, wao.issues, wao.author, wao.token_id, wao.collection_id, c.address, c.chainid
      ORDER BY num_worn_distinct DESC, num_worn desc) as data
where (data.rarity ILIKE $2)
  and ($3::integer IS NULL OR data.collection_id = $3::integer) limit $1;
