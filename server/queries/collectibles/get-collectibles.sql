select w.id,
       w.name,
       token_id,
       w.description,
       collection_id,
       c.name                                                                  as collection_name,
       c.chainid                                                               as chain_id,
       c.address                                                               as collection_address,
       issues,
       updated_at,
       w.author,
       (select name from avatars where lower(avatars.owner) = lower(w.author)) as author_name,
       hash
from wearables w
         left join
     collections c
     on collection_id = c.id
where (token_id is not null)
  AND (w.suppressed = false)
  AND ((w.name ILIKE $1 OR w.description ILIKE $1 or w.author ILIKE $1))
order by (CASE WHEN ($3::text = 'name' AND $4::boolean) THEN w.name::varchar END) ASC,
         (CASE WHEN ($3::text = 'name' AND NOT $4::boolean) THEN w.name::varchar END) DESC,
         (CASE WHEN ($3::text = 'issues' AND $4::boolean) THEN issues::varchar::int END) ASC,
         (CASE WHEN ($3::text = 'issues' AND NOT $4::boolean) THEN issues::varchar::int END) DESC,
         (CASE WHEN ($3::text = 'updated_at' AND $4::boolean) THEN updated_at END) ASC NULLS LAST,
         (CASE WHEN ($3::text = 'updated_at' AND NOT $4::boolean) THEN updated_at END) DESC NULLS LAST,
         (CASE WHEN ($3::text = 'prices' AND $4::boolean) THEN offer_prices[1]::numeric END) ASC NULLS FIRST,
         (CASE WHEN ($3::text = 'prices' AND NOT $4::boolean) THEN offer_prices[1]::numeric END) DESC NULLS LAST limit
  40
offset $2 * 40;