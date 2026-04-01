select (select count(id)
        from wearables
        where token_id is not null
          and suppressed = false) as total,
       (select count(distinct author)
        from wearables
        where token_id is not null
          and suppressed = false) as authors,
       (select count(distinct collection_id)
        from wearables
        where token_id is not null
          and suppressed = false) as collections
;