import { useEffect, useState } from 'preact/hooks'
import { route } from 'preact-router'
import { Login } from './auth/login'
import { app } from './state'

interface Props {
  path?: string
  id?: string
}

export default function SpaceEdit(props: Props) {
  if (!app.signedIn) return <Login reason="edit this space" />

  const [space, setSpace] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/spaces/${props.id}.json`)
      .then((r) => r.json())
      .then((d) => setSpace(d.space))
  }, [props.id])

  function set(key: string, value: any) {
    setSpace((s: any) => ({ ...s, [key]: value }))
  }

  function setSettings(key: string, value: any) {
    setSpace((s: any) => ({ ...s, settings: { ...s.settings, [key]: value } }))
  }

  async function submit(e: Event) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/spaces/${props.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: space.name,
        description: space.description,
        sandbox: !!space.settings?.sandbox,
        hosted_scripts: !!space.settings?.hosted_scripts,
        script_host_url: space.settings?.script_host_url,
        unlisted: !!space.unlisted,
        ...(hasSlug ? { slug: space.slug } : {}),
      }),
    })
    setSaving(false)
    route(`/spaces/${props.id}`)
  }

  if (!space) return <p>Loading...</p>

  // slug is only editable if it was already set and isn't a UUID
  const hasSlug = space.slug && space.slug.length !== 36

  return (
    <section class="columns">
      <article>
        <hgroup>
          <h1>
            <a href={`/spaces/${props.id}`}>{space.name || space.id}</a> / edit
          </h1>
        </hgroup>
        <form onSubmit={submit}>
          <div class="f">
            <label>Name</label>
            <input type="text" value={space.name || ''} onInput={(e: any) => set('name', e.target.value)} />
          </div>
          <div class="f">
            <label>Description</label>
            <textarea rows={5} value={space.description || ''} onInput={(e: any) => set('description', e.target.value)} />
          </div>
          <div class="f">
            <label>
              <input type="checkbox" checked={!!space.unlisted} onChange={(e: any) => set('unlisted', e.target.checked)} />
              Unlisted
            </label>
          </div>
          <div class="f">
            <label>
              <input type="checkbox" checked={!!space.settings?.sandbox} onChange={(e: any) => setSettings('sandbox', e.target.checked)} />
              Sandbox (publicly editable)
            </label>
          </div>
          <div class="f">
            <label>
              <input type="checkbox" checked={!!space.settings?.hosted_scripts} onChange={(e: any) => setSettings('hosted_scripts', e.target.checked)} />
              Hosted scripts (multiplayer)
            </label>
          </div>
          {space.settings?.hosted_scripts && (
            <div class="f">
              <label>Script host URL</label>
              <input type="text" value={space.settings?.script_host_url || ''} onInput={(e: any) => setSettings('script_host_url', e.target.value)} />
            </div>
          )}
          {hasSlug && (
            <div class="f">
              <label>Slug</label>
              <input type="text" value={space.slug || ''} onInput={(e: any) => set('slug', e.target.value)} />
            </div>
          )}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </article>
      <aside />
    </section>
  )
}
