import { readParcelAuthority, submitFederatedEdit, updateParcelPermissions, type ParcelAuthority } from '../../client/federated-edits'
import { useEffect, useRef, useState } from 'preact/hooks'
import strftime from 'strftime'
import { blocks } from '../../common/content/blocks'
import { Login } from './auth/login'
import SelectUser from './components/select-user'
import cachedFetch, { invalidateUrl } from './helpers/cached-fetch'
import { route } from 'preact-router'
import { app } from './state'
import { ParcelUser } from '../../common/helpers/parcel-helper'
import { AvatarLink } from './components/avatar-link'

type Version = {
  id: number
  parcel_id: number
  is_snapshot: boolean
  updated_at: string
  snapshot_name?: string
}

interface Props {
  path?: string
  id?: string
}

export default function ParcelEdit(props: Props) {
  if (!app.signedIn) return <Login reason="edit this parcel" />

  const [authority, setAuthority] = useState<ParcelAuthority | null>(null)
  const [error, setError] = useState('')
  const originalUsers = useRef('')
  const originalMetadata = useRef('')
  const [pendingPage, setPendingPage] = useState(0)
  const [parcel, setParcel] = useState<any>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [saving, setSaving] = useState(false)
  const [building, setBuilding] = useState(false)
  const [buildMaterial, setBuildMaterial] = useState(blocks[0].value)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const r = await cachedFetch(`/api/parcels/${props.id}.json`, { cache: 'reload' })
      const { parcel } = await r.json()
      setParcel(parcel)
      originalUsers.current = JSON.stringify(parcel.parcel_users ?? [])
      originalMetadata.current = JSON.stringify({ name: parcel.name, description: parcel.description })
      if (process.env.FEDERATION_WORLD) setAuthority(await readParcelAuthority(Number(props.id)))
      loadVersions()
    }

    void load().catch((error) => setError(error.message))
  }, [props.id])

  async function loadVersions() {
    const r = await fetch(`/api/parcels/${props.id}/history.json?limit=50&page=0&asc=false`, { credentials: 'include' })
    const d = await r.json()
    setVersions(d.versions ?? [])
  }

  function set(key: string, value: any) {
    setParcel((p: any) => ({ ...p, [key]: value }))
  }

  function setSettings(key: string, value: any) {
    setParcel((p: any) => ({ ...p, settings: { ...p.settings, [key]: value } }))
  }

  async function submit(e: Event) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (process.env.FEDERATION_WORLD) {
        if (originalUsers.current !== JSON.stringify(parcel.parcel_users ?? []) || authority?.permission.locked) await updateParcelPermissions(Number(props.id), parcel.parcel_users ?? [])
        const metadata = { name: parcel.name, description: parcel.description }
        if (originalMetadata.current !== JSON.stringify(metadata)) await submitFederatedEdit(Number(props.id), { metadata })
      } else
        await fetch(`/grid/parcels/${props.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: parcel.name,
            description: parcel.description,
            sandbox: !!parcel.sandbox,
            parcel_users: parcel.parcel_users ?? [],
          }),
        })
      await invalidateUrl(`/api/parcels/${props.id}.json`, true)
      route(`/parcels/${props.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save parcel')
    } finally {
      setSaving(false)
    }
  }

  async function approvePending(id: string) {
    setSaving(true)
    setError('')
    try {
      await updateParcelPermissions(Number(props.id), authority!.permission.users, [id])
      setAuthority(await readParcelAuthority(Number(props.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve change')
    } finally {
      setSaving(false)
    }
  }

  function back(e?: Event) {
    e?.preventDefault()
    route(`/parcels/${props.id}`)
  }

  async function build(fn: string) {
    if (!confirm(`Replace current build with "${fn}"? This will destroy existing content.`)) return
    setBuilding(true)
    await fetch(`/grid/parcels/${props.id}/build?function=${fn}&material=${buildMaterial}`, {
      method: 'POST',
      credentials: 'include',
    })
    setBuilding(false)
  }

  function addCollaborator(wallet: string) {
    if (!wallet) return
    const users: ParcelUser[] = parcel.parcel_users ?? []
    if (users.find((u) => u.owner.toLowerCase() === wallet.toLowerCase())) return
    set('parcel_users', [...users, { owner: wallet, role: 'contributor' }])
  }

  function removeCollaborator(wallet: string) {
    set(
      'parcel_users',
      (parcel.parcel_users ?? []).filter((u: ParcelUser) => u.owner !== wallet),
    )
  }

  function toggleRole(wallet: string) {
    set(
      'parcel_users',
      (parcel.parcel_users ?? []).map((u: ParcelUser) => (u.owner === wallet ? { ...u, role: u.role === 'owner' ? 'contributor' : 'owner' } : u)),
    )
  }

  async function takeSnapshot() {
    await fetch(`/api/parcels/snapshot`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcel_id: parcel.id }),
    })
    loadVersions()
  }

  async function revert(v: Version) {
    if (!confirm(`Revert to version #${v.id} from ${strftime('%B %-d, %Y at %-I%P', new Date(v.updated_at))}?`)) return
    if (process.env.FEDERATION_WORLD) {
      const r = await fetch(`/api/parcels/${v.parcel_id}/history/${v.id}.json`, { credentials: 'include', cache: 'no-store' })
      const data = await r.json()
      if (!r.ok || !data.version?.content) throw Error('Snapshot could not be read')
      await submitFederatedEdit(v.parcel_id, { content: data.version.content })
    } else
      await fetch(`/api/parcels/${v.parcel_id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parcel_version_id: v.id }),
      })
    loadVersions()
  }

  async function download(v: Version) {
    const r = await fetch(`/api/parcels/${v.parcel_id}/history/${v.id}.json`, { credentials: 'include' })
    const d = await r.json()
    const data = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(d.version))
    const a = document.createElement('a')
    a.href = data
    a.download = `${v.parcel_id}-${v.id}.json`
    a.click()
  }

  async function importJson(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files?.[0]) return
    const text = await input.files[0].text()
    let content
    try {
      content = JSON.parse(text).content ?? JSON.parse(text)
    } catch {
      alert('Invalid JSON')
      return
    }
    if (process.env.FEDERATION_WORLD) await submitFederatedEdit(parcel.id, { content })
    else
      await fetch(`/grid/parcels/${parcel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      })
    if (fileRef.current) fileRef.current.value = ''
    loadVersions()
  }

  if (!parcel) return <p role={error ? 'alert' : undefined}>{error || 'Loading...'}</p>

  const wallet = app.state.wallet?.toLowerCase()
  const isRootOwner = app.isOwner(parcel.owner) || (!!wallet && wallet === process.env.OWNER_ADDRESS?.toLowerCase())
  const isOwner = isRootOwner || (!!wallet && (parcel.parcel_users ?? []).some((u: ParcelUser) => u.owner.toLowerCase() === wallet && u.role === 'owner'))
  const isCollaborator = !!wallet && (parcel.parcel_users ?? []).some((u: ParcelUser) => u.owner.toLowerCase() === wallet && ['owner', 'contributor'].includes(u.role))
  const canEdit = isOwner || isCollaborator

  const title = (
    <hgroup>
      <h1>
        <a href={`/parcels/${props.id}`} onClick={back}>
          {parcel.name || parcel.address}
        </a>{' '}
        / edit
      </h1>
    </hgroup>
  )

  const form = (
    <form onSubmit={submit}>
      {error && <p role="alert">{error}</p>}
      {authority?.permission.locked && <p role="alert">Permission changes conflict. The parcel owner must review this list and save it before building resumes.</p>}
      {!!authority?.pending.length && (
        <section>
          <p>{authority.pendingCount} changes await review because their permissions changed. The signed records are retained.</p>
          {authority.pending.slice(pendingPage * 20, (pendingPage + 1) * 20).map((change) => (
            <p key={change.id}>
              Change from {change.signer}{' '}
              <a href={`/federation/edit/${change.id}`} target="_blank" rel="noopener noreferrer">
                Review signed changes
              </a>{' '}
              {isRootOwner && (
                <button type="button" disabled={saving} onClick={() => approvePending(change.id)}>
                  Include this change
                </button>
              )}
            </p>
          ))}
          {pendingPage > 0 && (
            <button type="button" onClick={() => setPendingPage(pendingPage - 1)}>
              Previous
            </button>
          )}
          {(pendingPage + 1) * 20 < authority.pending.length && (
            <button type="button" onClick={() => setPendingPage(pendingPage + 1)}>
              Next
            </button>
          )}
        </section>
      )}
      {!!authority?.unresolved?.length && (
        <details>
          <summary>{authority.unresolved.length} historical entries need a valid wallet</summary>
          <p>These records are preserved without granting access. Add a corrected wallet explicitly if appropriate.</p>
          <pre>{JSON.stringify(authority.unresolved, null, 2)}</pre>
        </details>
      )}
      <h3>basics</h3>
      <div class="f">
        <label>Name</label>
        <input type="text" value={parcel.name || ''} onInput={(e: any) => set('name', e.target.value)} />
      </div>
      <div class="f">
        <label>Description</label>
        <textarea rows={5} value={parcel.description || ''} onInput={(e: any) => set('description', e.target.value)} />
      </div>

      {!process.env.FEDERATION_WORLD && (
        <>
          <h3>settings</h3>
          <div class="f">
            <label>
              <input type="checkbox" checked={!!parcel.sandbox} onChange={(e: any) => set('sandbox', e.target.checked)} /> Sandbox
            </label>
          </div>
        </>
      )}

      {isOwner && (
        <>
          <h3>collaborators</h3>
          <SelectUser onSelect={addCollaborator} />
          {(parcel.parcel_users ?? []).length > 0 && (
            <ul>
              {(parcel.parcel_users as ParcelUser[]).map((u) => (
                <li key={u.owner}>
                  <AvatarLink avatar={u as any} />{' '}
                  <button type="button" onClick={() => toggleRole(u.owner)}>
                    {u.role === 'owner' ? 'Manager' : u.role === 'contributor' ? 'Builder' : u.role}
                  </button>{' '}
                  <button type="button" onClick={() => removeCollaborator(u.owner)}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button type="submit" disabled={saving || (!!authority?.permission.locked && !isRootOwner)}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </form>
  )

  const history = (
    <>
      <h3>edit history</h3>
      <div class="f">
        <button type="button" onClick={takeSnapshot}>
          Take snapshot
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={(e) => void importJson(e).catch((error) => setError(error.message))} />
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '10%' }} scope="col">
              Type
            </th>
            <th>Creation date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td>{v.is_snapshot && <small>snapshot</small>}</td>
              <td>
                <a
                  href="#"
                  onClick={(e: Event) => {
                    e.preventDefault()
                    void revert(v).catch((error) => setError(error.message))
                  }}
                >
                  {strftime('%B %-d, %Y at %-I%P', new Date(v.updated_at))}
                </a>
              </td>
              <td>
                <a
                  href="#"
                  onClick={(e: Event) => {
                    e.preventDefault()
                    download(v)
                  }}
                >
                  download
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )

  if (!canEdit) {
    return (
      <section>
        <article>
          {title}
          <p>You don't have permission to edit this parcel.</p>
        </article>
      </section>
    )
  }

  return (
    <section>
      <article>
        {title}
        {form}
        {history}
      </article>
    </section>
  )
}
