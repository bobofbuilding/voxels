select
  c.id, c.wallet, c.name, c.skin, c.default_color,
  (
    select json_agg(
      a || jsonb_build_object('wearable', json_build_object('id', w.id, 'name', w.name))
    )
    from jsonb_array_elements(c.attachments::jsonb) a
    left join wearables w on w.id = (a->>'wid')::uuid
  ) as attachments
from
  costumes c
where
  lower(c.wallet) = lower($1);
