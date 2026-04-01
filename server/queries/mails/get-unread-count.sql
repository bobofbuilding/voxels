select count(*)
from mails
where lower(destinator) = lower($1)
  and
    read = false