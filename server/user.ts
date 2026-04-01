import { Request } from 'express'
import { SuspendedAvatar } from './avatar'

export type VoxelsUser = Express.User & {
  wallet?: string
  moderator?: boolean

  suspended?: SuspendedAvatar | null
}

export type VoxelsUserRequest = Request & { user?: VoxelsUser }
