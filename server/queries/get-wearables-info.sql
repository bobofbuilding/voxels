select (select count(id)
        from wearables
        where token_id is not null) as total,
       (select count(distinct owner)
        from wearables
        where token_id is not null) as authors
;