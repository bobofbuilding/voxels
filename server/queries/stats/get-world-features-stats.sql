select feature ->>'type' as type, count (*) as count
from properties p, json_array_elements(content->'features') features (feature)
group by 1
order by 1;