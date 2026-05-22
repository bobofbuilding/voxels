import { useState } from 'preact/hooks'

function ord(n: number) {
  if (n >= 11 && n <= 13) return n + 'th'
  switch (n % 10) {
    case 1:
      return n + 'st'
    case 2:
      return n + 'nd'
    case 3:
      return n + 'rd'
    default:
      return n + 'th'
  }
}

export function fmt(iso: string) {
  const d = new Date(iso)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const dp = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).formatToParts(d)
  const tp = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).formatToParts(d)
  const tzPart = new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset', timeZone: tz }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value
  const weekday = dp.find((p) => p.type === 'weekday')?.value?.toLowerCase()
  const day = parseInt(dp.find((p) => p.type === 'day')?.value || '0')
  const month = dp.find((p) => p.type === 'month')?.value?.toLowerCase()
  const h = tp.find((p) => p.type === 'hour')?.value
  const m = tp.find((p) => p.type === 'minute')?.value
  const ampm = tp.find((p) => p.type === 'dayPeriod')?.value?.toLowerCase()
  const time = m === '00' ? `${h}${ampm}` : `${h}:${m}${ampm}`
  return `${weekday}, ${ord(day)} ${month} at ${time} (${tzPart})`
}

export default function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(!value)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function parse() {
    if (!text.trim()) return
    setLoading(true)
    const d = new Date()
    const off = -d.getTimezoneOffset()
    const sign = off >= 0 ? '+' : '-'
    const pad = (n: number) => String(n).padStart(2, '0')
    const now = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
    const r = await fetch('/api/models/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text, now }),
    }).then((r) => r.json())
    setLoading(false)
    if (r.error || !r.iso) {
      setError('could not parse date')
      return
    }
    onChange(r.iso)
    setEditing(false)
    setError(null)
  }

  if (!editing && value) {
    const nice = fmt(value)
    return (
      <span title={value}>
        {nice} &mdash; <a onClick={() => setEditing(true)}>change</a>
      </span>
    )
  }

  return (
    <span>
      <input type="text" value={text} onInput={(e: any) => setText(e.target.value)} placeholder="e.g. tomorrow at 3pm, next friday 7pm" onKeyDown={(e: any) => e.key === 'Enter' && (e.preventDefault(), parse())} />
      <button type="button" onClick={parse} disabled={loading}>
        {loading ? '...' : 'Set'}
      </button>
      {error && <small>{error}</small>}
    </span>
  )
}
