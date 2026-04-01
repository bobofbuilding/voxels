select c.*
from costumes c
         left JOIN
     avatars a
     on a.costume_id = c.id
where lower(a.owner) = lower($1)