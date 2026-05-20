import { AvatarRef, avatarName, avatarSlug } from '../../../common/messages/avatar-ref'

export const AvatarLink = ({ avatar }: { avatar: AvatarRef | null | undefined }) => {
  if (!avatar) return null
  return <a href={`/u/${avatarSlug(avatar)}`}>{avatarName(avatar)}</a>
}
