-- Migrations necessary for circle CI's local docker when testing.
-- If you have a feature that has tape tests using a DB, this is where you add the CREATE table for CI to return a successful test.

CREATE TABLE banned_users (
  id SERIAL PRIMARY KEY,wallet text NOT NULL,reason text null,expires_at TIMESTAMP DEFAULT (NOW()+INTERVAL '7 days'),
  can_chat BOOLEAN DEFAULT false,can_build BOOLEAN DEFAULT false,created_at TIMESTAMP DEFAULT NOW()
  );


CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    wallet text not null,
    parcel_id integer NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
   CONSTRAINT uniqueFavorite UNIQUE (wallet, parcel_id)
  );
    CREATE UNIQUE INDEX wallet_parcel_id_idx on favorites (wallet,parcel_id);

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE TABLE properties(
  id SERIAL PRIMARY KEY,
  price double precision,
  owner text COLLATE pg_catalog."default",
  address text COLLATE pg_catalog."default",
  visible boolean DEFAULT false,
  token integer,
  content json,
  geometry_json jsonb,
  x1 integer,
  x2 integer,
  z1 integer,
  z2 integer,
  bounds cube,
  distance_to_center double precision DEFAULT 0,
  distance_to_ocean double precision DEFAULT 0,
  distance_to_closest_common double precision DEFAULT 0,
  traffic_visits integer DEFAULT 0,
  is_common boolean DEFAULT false,
  settings json,
  minted boolean DEFAULT false,
  name text COLLATE pg_catalog."default",
  free_edit boolean DEFAULT false,
  minted_at timestamp without time zone,
  updated_at timestamp without time zone,
  contributors text[] COLLATE pg_catalog."default",
  sandbox boolean DEFAULT false,
  rating double precision DEFAULT 0,
  description text COLLATE pg_catalog."default",
  nipsa boolean DEFAULT false,
  kind text COLLATE pg_catalog."default",
  y1 integer,
  y2 integer,
  suburb_id integer,
  island text COLLATE pg_catalog."default",
  grid boolean DEFAULT false,
  bake boolean DEFAULT false,
  lightmap_url text,
  state json,
  hash text COLLATE pg_catalog."default",
  memoized_hash text COLLATE pg_catalog."default",
  label text COLLATE pg_catalog."default",
  listed_at timestamp without time zone
  )WITH (
    OIDS = FALSE
);

CREATE INDEX properties_minted_idx
    ON properties USING btree
    (minted ASC NULLS LAST)
    TABLESPACE pg_default;


CREATE TABLE suburbs
(
    id SERIAL PRIMARY KEY,
    name text COLLATE pg_catalog."default",
    position_json jsonb
)
WITH (
    OIDS = FALSE
);


CREATE TABLE islands
(
    id SERIAL PRIMARY KEY,
    name text COLLATE pg_catalog."default",
    texture text COLLATE pg_catalog."default",
    geometry_json jsonb,
    position_json jsonb,
    content json,
    holes_geometry_json jsonb,
    lakes_geometry_json jsonb,
    other_name text
)
WITH (
    OIDS = FALSE
);

  CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    name text,
    description text,
    image_url text,
    owner text,
    address text,
    slug text,
    type text,
    chainid integer DEFAULT 1,
    collectibles_type text,
    settings json,
    custom_attributes_names json[],
    suppressed boolean DEFAULT false,
    discontinued boolean DEFAULT false,
    rejected_at timestamp,
    logo bytea,
    created_at timestamp DEFAULT NOW()
  );

  CREATE TABLE wearables (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    description text,
    author text,
    issues integer DEFAULT 1,
    data bytea,
    collection_id integer REFERENCES collections(id),
    token_id integer,
    hash text,
    custom_attributes json,
    category text,
    suppressed boolean DEFAULT false,
    offer_prices numeric[],
    rejected_at timestamp,
    default_settings json,
    created_at timestamp DEFAULT NOW(),
    updated_at timestamp DEFAULT NOW()
  );

  CREATE TABLE costumes (
    id SERIAL PRIMARY KEY,
    wallet text,
    name text,
    attachments json,
    skin text,
    default_color text DEFAULT '#f3f3f3'
  );

  CREATE TABLE avatars (
    id SERIAL PRIMARY KEY,
    owner text,
    name text,
    settings json,
    moderator boolean,
    costume_id integer REFERENCES costumes(id),
    type text,
    description text,
    social_link_1 text,
    social_link_2 text,
    names text[],
    created_at timestamp DEFAULT NOW(),
    last_online timestamp
  );

    CREATE TABLE parcel_events (
    id SERIAL PRIMARY KEY,
    parcel_id INTEGER,
    author text NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    color TEXT DEFAULT 'mintcream',
    timezone TEXT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    starts_at timestamptz DEFAULT NOW(),
    expires_at timestamptz DEFAULT (NOW() + INTERVAL '1 hour'),
    category VARCHAR(255)
  );


  CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    reason TEXT NOT NULL,
    extra TEXT NULL,
    author TEXT NOT NULL,
    type TEXT NOT NULL,
    reported_id TEXT NOT NULL,
	  resolved boolean default false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  create UNIQUE index report_id_index on reports (id);

