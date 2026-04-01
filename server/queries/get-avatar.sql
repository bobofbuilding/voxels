select avatars.id,
       owner,
       avatars.name,
       avatars.type,
       description,
       social_link_1,
       social_link_2, names, moderator, settings, created_at, last_online, costume_id, row_to_json(costumes.*) as costume
from
    avatars
    left join costumes
on costumes.id = avatars.costume_id
where
    lower (avatars.owner) = lower ($1);