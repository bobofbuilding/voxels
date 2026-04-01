select wearables.id,
       wearables.updated_at,
       wearables.name,
       token_id,
       category,
       wearables.description,
       collection_id,
       collections.chainid                                                                     as chain_id,
       collections.address                                                                     as collection_address,
       issues,
       author,
       (select avatars.name from avatars where lower(avatars.owner) = lower(wearables.author)) as author_name,
       hash
from wearables
         INNER JOIN
     collections
     on wearables.collection_id = collections.id
where (token_id is not null)
  AND (NOT wearables.suppressed)
  AND (collections.chainid = coalesce($1, 1) AND lower(collections.address) = lower($2))
  AND ((wearables.name ILIKE $3 OR wearables.description ILIKE $3 or author ILIKE $3))
order by (CASE WHEN ($5::text = 'name' AND $6::boolean) THEN wearables.name::varchar END) ASC,
         (CASE WHEN ($5::text = 'name' AND NOT $6::boolean) THEN wearables.name::varchar END) DESC,
         (CASE WHEN ($5::text = 'issues' AND $6::boolean) THEN issues::varchar::int END) ASC,
         (CASE WHEN ($5::text = 'issues' AND NOT $6::boolean) THEN issues::varchar::int END) DESC,
         (CASE WHEN ($5::text = 'updated_at' AND $6::boolean) THEN wearables.updated_at END) ASC,
         (CASE WHEN ($5::text = 'updated_at' AND NOT $6::boolean) THEN wearables.updated_at END) DESC limit
  50
offset $4 * 50;