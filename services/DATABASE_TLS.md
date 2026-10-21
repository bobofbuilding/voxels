Database connections require certificate and hostname verification for every remote host.
The server, renderer, compiler and multiplayer clients share `databaseConnectionOptions`.
Set `CA_CERT` (or `DATABASE_CA_CERT`) to the intended database provider's PEM CA for a
private CA. A `sslrootcert` URL file remains supported, as do client `sslcert`/`sslkey` files.
Use the provider's certificate hostname in `DATABASE_URL`.

Exact loopback hosts and Unix sockets can still run an isolated local database without
TLS. `DATABASE_SSL=disable` is rejected for remote databases. URL TLS settings cannot
weaken verification. Remove `NODE_TLS_REJECT_UNAUTHORIZED=0` from deployment and shell
environments; database clients and the compressor reject that setting at startup.

Before rollout, confirm the intended CA and database hostname, rebuild every service and
exercise a valid connection plus unknown-issuer and wrong-host failures through each
running database client. Source tests do not prove the production environment or image.

Run the isolated TLS regression with Node 24.22.1 or later:

    node --experimental-strip-types --test services/database-tls.test.mjs
