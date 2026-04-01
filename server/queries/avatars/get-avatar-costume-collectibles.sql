with attchmnts as (select json_array_elements(c.attachments) as a
                   from avatars
                            left JOIN
                        costumes c
                        on
                            costume_id = c.id
                   where lower(avatars.owner) = lower($1)
                     and avatars.costume_id is not null
                     and c.attachments
    ::text <> 'null'
    )
   , wearables_info as (
SELECT
    (a->>'wearable_id'):: integer as wearable_id, coalesce ((a->>'collection_id'):: integer, 1) as collection_id, w.issues as issues, w.name as name, (a->>'bone')::text as bone
FROM attchmnts
    left JOIN
    wearables w
on
    (a->>'wearable_id'):: integer = w.token_id and coalesce ((a->>'collection_id'):: integer,1) = w.collection_id
where w.token_id is not null
    )

select *,
       (select c.name from collections c where c.id = winfo.collection_id)    as collection_name,
       (select c.chainid from collections c where c.id = winfo.collection_id) as chain_id,
       (select c.address from collections c where c.id = winfo.collection_id) as collection_address
from wearables_info winfo