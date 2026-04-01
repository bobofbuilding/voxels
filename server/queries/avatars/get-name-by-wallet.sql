select name
from avatars
where lower(owner) = lower($1);
