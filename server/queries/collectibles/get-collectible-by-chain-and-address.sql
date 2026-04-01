select w.id,
       offer_prices,
       token_id,
       w.name,
       w.description,
       collection_id,
       category,
       issues,
       w.author,
       hash,
       custom_attributes,
       w.suppressed,
       c.name                                                                  as collection_name,
       c.address                                                               as collection_address,
       c.custom_attributes_names                                               as collection_attributes_names,
       c.chainid                                                               as chain_id,
       (select name from avatars where lower(avatars.owner) = lower(w.author)) as author_name
from wearables w
         left join collections c
                   on c.id = w.collection_id
where c.chainid = $1::integer and lower(c.address) = lower($2) and token_id = $3
limit
  1;