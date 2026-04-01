select id,
       owner,
       name,
       description,
       social_link_1,
       social_link_2, names, moderator, settings, created_at, last_online, costume_id, ((select row_to_json(d) from (select * from costumes c where costume_id = c.id) d )) as costume
from
    avatars
where
    lower (avatars.owner) = lower ($1)
   OR lower (avatars.name) = lower ($1);