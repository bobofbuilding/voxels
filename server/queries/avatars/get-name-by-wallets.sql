select owner,
       name
from avatars
where lower(owner) in (SELECT lower(unnest($1::text[])::text))