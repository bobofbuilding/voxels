select count(*) as num_ongoing_events
from parcel_events
WHERE expires_at > NOW();
