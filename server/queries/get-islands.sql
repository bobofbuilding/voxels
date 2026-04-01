select id,
       name,
       texture,
       holes_geometry_json,
       lakes_geometry_json,
       content,
       geometry_json as geometry,
       position_json as position
from islands
order by id asc;
