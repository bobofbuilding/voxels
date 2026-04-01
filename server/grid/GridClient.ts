import { GridMessage } from '../../common/messages/grid'
import { VoxelsUser } from '../user'

export type GridClient = {
  id: string
  user: VoxelsUser | null
  send(message: GridMessage): void
  close(): void
}
