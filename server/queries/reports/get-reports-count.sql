select (select count(*) from reports where 'womp' = reports.type and resolved is not true)          as total_womps,
       (select count(*) from reports where 'avatar' = reports.type and resolved is not true)        as total_avatars,
       (select count(*) from reports where 'library-asset' = reports.type and resolved is not true) as total_library_asset,
       (select count(*) from reports where 'collectible' = reports.type and resolved is not true)   as total_collectibles,
       (select count(*) from reports where 'parcel' = reports.type and resolved is not true)        as total_parcels
