select id,
       offer_prices,
       token_id,
       name,
       description,
       collection_id,
       issues,
       author,
       hash,
       custom_attributes,
       suppressed,
       (select name from collections where collections.id = wearables.collection_id)                                as collection_name,
       (select address from collections where collections.id = wearables.collection_id)                             as collection_address,
       (select collections.custom_attributes_names
        from collections
        where collections.id = wearables.collection_id)                                                             as collection_attributes_names,
       (select chainid from collections where collections.id = wearables.collection_id)                             as chain_id,
       (select name from avatars where lower(avatars.owner) = lower(wearables.author))                              as author_name
from wearables
where id = $1 limit
  1;