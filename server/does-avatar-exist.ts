import db from './pg'

export async function doesAvatarExist(wallet: string) {
  // Ensure avatar record exists
  const {
    rows: [{ count }],
  } = await db.query(
    'embedded/get-avatar-by-wallet',
    `
    SELECT COUNT(*)
    FROM
      avatars
    WHERE 
      lower(owner) = lower($1)
    `,
    [wallet],
  )

  return count > 0
}
