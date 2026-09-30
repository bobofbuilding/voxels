-- Standalone multiplayer state only. Not a replacement for the world application database.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE TABLE IF NOT EXISTS chat_messages (
 id text PRIMARY KEY, uuid text NOT NULL, text text NOT NULL,
 avatar jsonb, moderated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_recent ON chat_messages(created_at DESC);
CREATE TABLE IF NOT EXISTS avatars (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, owner text NOT NULL,
 name text, costume_id bigint, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS avatars_owner ON avatars(lower(owner));
CREATE TABLE IF NOT EXISTS banned_users (
 wallet text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS properties (id integer PRIMARY KEY, traffic_visits bigint NOT NULL DEFAULT 0);
CREATE SCHEMA IF NOT EXISTS metrics;
DO $$ BEGIN
 FOR i IN 0..6 LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS metrics.day_%s (client_id bigint, action integer, parcel integer, position cube, created_at timestamptz NOT NULL DEFAULT now())', lpad(i::text, 2, '0'));
  EXECUTE format('CREATE INDEX IF NOT EXISTS metrics_created_%s ON metrics.day_%s(created_at)', i, lpad(i::text, 2, '0'));
 END LOOP;
END $$;
