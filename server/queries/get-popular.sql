 SELECT 
  t.*,
  jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'address', p.address,
    'description', p.description
  ) AS parcel
FROM (
  SELECT 
    DISTINCT ON (parcel_id) parcel_id, day
  FROM 
    traffic                                    
  WHERE 
    visits > 1
  ORDER BY 
    parcel_id, day DESC
  LIMIT 
    100
) recent
JOIN 
    traffic t ON t.parcel_id = recent.parcel_id AND t.day = recent.day
JOIN 
    properties p ON p.id = t.parcel_id           
ORDER BY 
    t.visits DESC
LIMIT 
    100;
