select wallet,
       role,
       avatars.name
from parcel_users
         left join avatars
                   on lower(avatars.owner) = lower(wallet)
where parcel_id = $1
