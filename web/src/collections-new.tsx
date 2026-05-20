import { Login } from './auth/login'
import { useState } from 'preact/hooks'
import { app } from './state'
import { fetchOptions } from './utils'

export default function CollectionsNew({ path }: { path?: string }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!app.signedIn) return <Login reason="create a collection" />

  async function submit(e: Event) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    const r = await fetch('/api/collections/create', {
      ...fetchOptions(),
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description }),
    }).then((r) => r.json())
    if (!r.success) {
      setSubmitting(false)
      setError(r.message || 'Error')
      return
    }
    window.location.href = `/collections/${r.collection_id}`
  }

  return (
    <section>
      <hgroup>
        <h1>New Collection</h1>
        <p>wearables and assets, together. publish on-chain if you want.</p>
      </hgroup>

      <article>
        <form onSubmit={submit}>
          <div class="f">
            <label>Name</label>
            <input type="text" value={name} onInput={(e: any) => setName(e.target.value)} />
          </div>
          <div class="f">
            <label>Description</label>
            <textarea value={description} onInput={(e: any) => setDescription(e.target.value)} />
          </div>
          {error && <p>{error}</p>}
          <button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </form>
      </article>
    </section>
  )
}
