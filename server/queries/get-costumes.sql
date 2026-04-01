select 
  *
from 
  costumes
where 
  lower(wallet) = lower($1);