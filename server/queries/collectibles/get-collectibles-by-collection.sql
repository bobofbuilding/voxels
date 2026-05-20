select 
  wearables.id,
  wearables.updated_at,
  wearables.name,
  token_id,
  category,
  wearables.description,
  issues,
  COALESCE(
    (SELECT row_to_json(sub) FROM (SELECT a.id, a.name, a.owner, a.created_at FROM avatars a WHERE lower(a.owner) = lower(wearables.author) LIMIT 1) sub),
    to_json(wearables.author)
  ) as author,
  hash
from 
  wearables 
where
  collection_id = $1
limit 
  256;
