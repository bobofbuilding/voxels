WITH mysub AS (SELECT json_array_elements(properties.content -> 'features') ->>'type' as f
FROM
    properties
where
    properties.minted = true
    )
    , c as (
select
    (select array_to_json(array_agg(row_to_json(t))) from (select wallet, role from parcel_users where parcel_id=p.id) t) as parcel_users
from
    properties p
where
    p.minted = true
    )
select (SELECT count(*) FROM (select properties.id FROM properties WHERE properties.minted = true) as p)                               as num_parcels,
       (SELECT count(*)
        FROM (select properties.id
              FROM properties
              WHERE properties.name <> properties.address
                AND properties.minted = true) as p)                                                                                    as num_parcels_with_different_name,
       (SELECT count(*)
        FROM (select properties.id
              FROM properties
              WHERE lightmap_url is not null
                AND properties.minted = true) as p)                                                                                    as num_parcels_with_baking,
       (SELECT count(*)
        FROM (select properties.id
              FROM properties
              WHERE ARRAY_LENGTH(c.parcel_users, 1) > 0
                AND properties.minted = true) as p)                                                                                    as num_parcels_with_contributors,
       json_build_object('spawn', (SELECT count(*) FROM mysub WHERE mysub.f = 'spawn-point'),
                         'vox', (SELECT count(*) FROM mysub WHERE mysub.f = 'vox-model'),
                         'megavox', (SELECT count(*) FROM mysub WHERE mysub.f = 'megavox'),
                         'image', (SELECT count(*) FROM mysub WHERE mysub.f = 'image'),
                         'nftimage', (SELECT count(*) FROM mysub WHERE mysub.f = 'nft-image'),
                         'button', (SELECT count(*) FROM mysub WHERE mysub.f = 'button'),
                         'audio', (SELECT count(*) FROM mysub WHERE mysub.f = 'audio'),
                         'video', (SELECT count(*) FROM mysub WHERE mysub.f = 'video'),
                         'youtube', (SELECT count(*) FROM mysub WHERE mysub.f = 'youtube'),
                         'boombox', (SELECT count(*) FROM mysub WHERE mysub.f = 'boombox'),
                         'polytext', (SELECT count(*) FROM mysub WHERE mysub.f = 'polytext'),
                         'lantern', (SELECT count(*) FROM mysub WHERE mysub.f = 'lantern'),
                         'particles', (SELECT count(*) FROM mysub WHERE mysub.f = 'particles'),
                         'richtext', (SELECT count(*) FROM mysub WHERE mysub.f = 'richtext'),
                         'sign', (SELECT count(*) FROM mysub WHERE mysub.f = 'sign'),
                         'textinput',
                         (SELECT count(*) FROM mysub WHERE mysub.f = 'text-input'))                                                    as features
from properties
         cross join mysub
where properties.minted = true Limit
1