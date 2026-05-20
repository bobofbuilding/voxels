import { useEffect, useState } from 'preact/hooks'
import { ApiAvatar } from '../../common/messages/api-avatars'
import { AddPasskey, Login } from '../src/auth/login'
import ParcelField from '../src/components/parcel-field'
import { app } from '../src/state'

export default function EditAccount() {
  if (!app.signedIn) return <Login reason="edit your account" />

  const [avatar, setAvatar] = useState<ApiAvatar | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [link1, setLink1] = useState('')
  const [link2, setLink2] = useState('')
  const [home, setHome] = useState<{ parcel_id?: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wallet = app.state?.wallet

  useEffect(() => {
    if (!wallet) return
    fetch(`/api/avatars/${wallet}.json`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: any) => {
        const a = data.avatar
        setAvatar(a)
        setName(a?.name ?? '')
        setDescription(a?.description ?? '')
        setLink1(a?.social_link_1 ?? '')
        setLink2(a?.social_link_2 ?? '')
        if (a?.home_id) setHome({ parcel_id: a.home_id })
      })
  }, [wallet])

  async function submit(e: Event) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const r = await fetch('/api/avatar', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || undefined,
        description,
        social_link_1: link1,
        social_link_2: link2,
        home_id: home?.parcel_id ?? null,
      }),
    }).then((r) => r.json())
    setSaving(false)
    if (!r.success) {
      setError(r.message || 'Error')
      return
    }
    app.send({ type: 'reconnect' })
    window.location.href = `/avatar/${wallet}`
  }

  return (
    <section class="columns">
      <hgroup>
        <h1>edit account</h1>
        <a href={`/avatar/${wallet}`}>back to profile</a>
      </hgroup>
      <article>
        <form onSubmit={submit}>
          <div class="f">
            <label>username</label>
            <input type="text" value={name} onInput={(e: any) => setName(e.target.value)} placeholder="letters and numbers, starts with a letter" disabled={!!avatar?.name} />
            {!avatar?.name && <small>3-50 chars, letters and numbers only. can only be set once.</small>}
          </div>
          <div class="f">
            <label>description</label>
            <textarea value={description} rows={4} onInput={(e: any) => setDescription(e.target.value)} />
          </div>
          <div class="f">
            <label>External Links</label>
            <input type="url" value={link1} onInput={(e: any) => setLink1(e.target.value)} placeholder="https://..." />
            <br />
            <input type="url" value={link2} onInput={(e: any) => setLink2(e.target.value)} placeholder="https://..." />
          </div>
          <div class="f">
            <label>home parcel</label>
            <ParcelField value={home ?? undefined} onChange={(r) => setHome(r.parcel_id ? r : null)} />
          </div>
          {error && <p>{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
        {name && (
          <>
            <hr />
            <div class="f">
              <label>add passkey</label>
              <AddPasskey username={name} />
            </div>
          </>
        )}
      </article>
    </section>
  )
}
