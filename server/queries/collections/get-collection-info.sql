select (select count(wearables.id)
        from wearables
                 INNER JOIN
             collections
             on wearables.collection_id = collections.id
        where token_id is not null
          and (collections.chainid = coalesce($1, 1) AND lower(collections.address) = lower($2))) as total,
       (select count(distinct author)
        from wearables
                 INNER JOIN
             collections
             on wearables.collection_id = collections.id
        where token_id is not null
          and (collections.chainid = coalesce($1, 1) AND lower(collections.address) = lower($2))) as authors
;