select p.id,
       p.name,
       address,

       lower(p.owner) as owner,
       a.name         as owner_name,

       (content ->>'features')::json as features, (content ->>'tileset') ::text as tileset

from properties p
         left join
     avatars a
     on
         lower(a.owner) = lower(p.owner)
where lower(p.owner) = lower($1)
  AND p.minted = true
group by p.id, a.name;