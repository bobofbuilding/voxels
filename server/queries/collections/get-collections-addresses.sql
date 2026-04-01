select address,
       owner,
       chainid,
       discontinued,
       (select count(id)
        from wearables
        where token_id is not null
          and wearables.collection_id = collections.id) as collectible_count,
       id
from collections
where id is not null
  and address is not null