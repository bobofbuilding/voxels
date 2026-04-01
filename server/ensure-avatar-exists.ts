import db from './pg'

export async function ensureAvatarExists(wallet: string) {
  // Ensure avatar record exists
  await db.query(
    'sql/upsert-avatar-by-wallet',
    `
    INSERT INTO
      avatars (owner,last_online)
    VALUES
      ($1,now())
    ON CONFLICT (owner) DO UPDATE
      SET owner = $1,last_online = now()
    `,
    [wallet.toLowerCase()],
  )
}
