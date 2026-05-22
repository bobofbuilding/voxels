select id,
       offer_prices,
       token_id,
       name,
       description,
       collection_id,
       issues,
       COALESCE(
         (SELECT row_to_json(sub) FROM (SELECT a.id, a.name, a.owner, a.created_at FROM avatars a WHERE lower(a.owner) = lower(wearables.author) LIMIT 1) sub),
         to_json(wearables.author)
       ) as author,
       hash,
       custom_attributes,
       suppressed,
       (select name from collections where collections.id = wearables.collection_id) as collection_name,
       (select address from collections where collections.id = wearables.collection_id) as collection_address,
       (select collections.custom_attributes_names
        from collections
        where collections.id = wearables.collection_id) as collection_attributes_names,
       (select chainid from collections where collections.id = wearables.collection_id) as chain_id
from wearables
where id = $1 limit
  1;
