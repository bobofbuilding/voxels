select count(id)                                                                                    as total,
       json_agg(lower(author))                                                                      as authors,
       json_agg((select name from avatars where lower(avatars.owner) = lower(emoji_badges.author))) as authors_name,
       emoji
from emoji_badges
WHERE emojiable_type = 'womps'
  AND emojiable_id = ($1)::text -- AND expires_at> NOW()
GROUP by
    emoji
order by
    total desc;
