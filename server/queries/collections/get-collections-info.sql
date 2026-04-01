select (select count(id)
        from collections
        where id is not null) as total
;