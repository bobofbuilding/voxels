select w.id,
       offer_prices,
       token_id,
       w.name,
       w.description,
       collection_id,
       category,
       issues,
       COALESCE(
         (SELECT row_to_json(sub) FROM (SELECT a.id, a.name, a.owner, a.created_at FROM avatars a WHERE lower(a.owner) = lower(w.author) LIMIT 1) sub),
         to_json(w.author)
       ) as author,
       hash,
       custom_attributes,
       w.suppressed,
       c.name as collection_name,
       c.address as collection_address,
       c.custom_attributes_names as collection_attributes_names,
       c.chainid as chain_id
from wearables w
         left join collections c
                   on c.id = w.collection_id
where c.chainid = $1::integer and lower(c.address) = lower($2) and token_id = $3
limit
  1;
