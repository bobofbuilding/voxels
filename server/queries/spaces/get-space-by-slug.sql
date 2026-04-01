select id
from spaces
where slug ILIKE $1
limit 1;