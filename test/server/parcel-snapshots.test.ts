// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'
vi.mock('../../server/parcel', () => ({ default: { load: vi.fn(async () => ({ id: 1 })) } }))
vi.mock('../../server/auth-parcel', () => ({ default: vi.fn(async () => 'Owner') }))
vi.mock('../../server/permissions', () => ({ isAdminWallet: vi.fn() }))
vi.mock('../../server/handlers/update-parcel', () => ({ revertParcel: vi.fn(), sandboxRollback: vi.fn() }))
vi.mock('../../server/handlers/vox-export', () => ({ default: vi.fn() }))
vi.mock('../../server/cache', () => ({ default: () => vi.fn(), noCache: vi.fn() }))
vi.mock('../../server/lib/query-helpers', () => ({ createRequestHandlerForQuery: () => vi.fn(), queryAndCallback: vi.fn() }))
import routes from '../../server/controllers/parcels'
import authParcel from '../../server/auth-parcel'
const handlers = new Map<string, any>()
const query = vi.fn(async (..._args: any[]) => ({ rows: [] }))
const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'use'].map((method) => [method, (path: string, ...callbacks: any[]) => handlers.set(method + path, callbacks.at(-1))]))
routes({ query } as any, { authenticate: () => vi.fn() } as any, app as any)
async function request(method: string, path: string, body: any) {
  const response = { status: vi.fn(), send: vi.fn(), json: vi.fn() }
  response.status.mockReturnValue(response)
  await handlers.get(method + path)({ body, user: { wallet: 'test-owner' } }, response)
  return response
}
beforeEach(() => {
  query.mockClear()
  vi.mocked(authParcel).mockResolvedValue('Owner')
})
test('snapshot marking and removal bind the version to the authorized parcel', async () => {
  const marked = await request('post', '/api/parcels/snapshot', { parcel_id: 1, id: 99 })
  expect(query.mock.calls[0][1]).toContain('where id = $1 and parcel_id=$2')
  expect(query.mock.calls[0][2]).toEqual([99, 1])
  expect(marked.send).toHaveBeenCalledWith({ success: false })
  query.mockClear()
  const removed = await request('post', '/api/parcels/snapshot/remove', { version: { id: 99, parcel_id: 1 } })
  expect(query.mock.calls[0][1]).toContain('where id = $1 and parcel_id=$2')
  expect(query.mock.calls[0][2]).toEqual([99, 1])
  expect(removed.send).toHaveBeenCalledWith({ success: false, id: null })
})
test('builders cannot rename snapshots and manager renames stay scoped to their parcel', async () => {
  vi.mocked(authParcel).mockResolvedValue('Collaborator')
  const denied = await request('put', '/api/parcels/snapshot', { version: { id: 99, parcel_id: 1 }, name: 'Changed' })
  expect(denied.status).toHaveBeenCalledWith(403)
  expect(query).not.toHaveBeenCalled()
  vi.mocked(authParcel).mockResolvedValue('Owner')
  await request('put', '/api/parcels/snapshot', { version: { id: 99, parcel_id: 1 }, name: 'Changed' })
  expect(query.mock.calls[0][1]).toContain('where id = $2 and parcel_id=$3')
  expect(query.mock.calls[0][2]).toEqual(['Changed', 99, 1])
})
