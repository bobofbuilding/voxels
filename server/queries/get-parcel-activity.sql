select t.hash,
       t.block,
       t.parcel_id,
       t.created_at,
       p.name,
       p.address,
       coalesce((select jsonb_build_object('owner', a.owner, 'name', a.name) from avatars a where lower(a.owner) = lower(t.from_wallet) limit 1), jsonb_build_object('owner', lower(t.from_wallet))) as "from",
       coalesce((select jsonb_build_object('owner', a.owner, 'name', a.name) from avatars a where lower(a.owner) = lower(t.to_wallet) limit 1), jsonb_build_object('owner', lower(t.to_wallet))) as "to",
       -- only the newest transfer of a parcel says anything about who owns it now
       case when exists (select 1 from parcel_transfers n where n.parcel_id = t.parcel_id and (n.block, n.log_index) > (t.block, t.log_index)) then null
            else lower(p.owner) = lower(t.to_wallet) end as synced
  from parcel_transfers t
  left join properties p on p.id = t.parcel_id
 order by t.block desc, t.log_index desc
 limit 100
