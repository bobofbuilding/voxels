SELECT 
  id, title as name, kind as type, description, created_at, ts_rank(search_tsv, plainto_tsquery('english', $1)) AS rank
FROM   
  search_corpus
WHERE  
  search_tsv @@ plainto_tsquery('english', $1)
ORDER BY 
  rank DESC, created_at DESC
LIMIT  
  $2
OFFSET 
  $3;

-- Refresh when you need to pick up new/updated rows:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY search_corpus;

