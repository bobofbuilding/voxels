import { useEffect, useState } from 'preact/hooks'
import { route } from 'preact-router'
import { Login } from './auth/login'
import { app } from './state'

interface Props {
  path?: string
  id?: string
}

export default function CollectionEdit(props: Props) {
  if (!app.signedIn) return <Login reason="edit this collection" />

  const [col, setCol] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/collections/${props.id}`)
      .then((r) => r.json())
      .then((d) => setCol(d.collection))
  }, [props.id])

  async function submit(e: Event) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/collections/${props.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(col),
    })
    setSaving(false)
    route(`/collections/${props.id}`)
  }

  function set(key: string, value: any) {
    setCol((c: any) => ({ ...c, [key]: value }))
  }

  if (!col) return <p>Loading...</p>

  return (
    <section class="columns">
      <article>
        <hgroup>
          <h1>
            <a href={`/collections/${props.id}`}>{col.name}</a> / edit
          </h1>
        </hgroup>
        <form onSubmit={submit}>
          <div class="f">
            <label>Name</label>
            <input type="text" value={col.name} onInput={(e: any) => set('name', e.target.value)} />
          </div>
          <div class="f">
            <label>Description</label>
            <textarea value={col.description} onInput={(e: any) => set('description', e.target.value)} rows={5} />
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </article>
      <aside>{/* <button onClick={onDelete}>Delete</button> */}</aside>
    </section>
  )
}
