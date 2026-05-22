import { useEffect, useRef, useState } from 'preact/hooks'

const ALLOWED_DOMAINS = ['voxels.com', 'oncyber.io', 'substrata.info', 'somniumspace.com', 'hyperfy.io', 'resonite.com', 'overte.org', 'decentraland.com']

type Result = { parcel_id?: number; location_url?: string }
type Props = { value?: Result; onChange: (r: Result) => void }
type Parcel = { id: number; name: string }

function isAllowedUrl(s: string): boolean {
  try {
    const host = new URL(s).hostname.replace('www.', '')
    return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith('.' + d))
  } catch {
    return false
  }
}

export default function ParcelField({ value, onChange }: Props) {
  const [text, setText] = useState('')
  const [results, setResults] = useState<Parcel[]>([])
  const [picked, setPicked] = useState<{ label: string; url?: string } | null>(null)
  const timer = useRef<any>(null)

  useEffect(() => {
    if (value?.parcel_id && !picked) {
      fetch(`/api/parcels/${value.parcel_id}.json`)
        .then((r) => r.json())
        .then(({ parcel }) => {
          if (!parcel) return
          const label = parcel.name || parcel.address
          setPicked({ label, url: `/parcels/${parcel.id}` })
          setText(label)
        })
    }
  }, [value?.parcel_id])

  useEffect(() => {
    if (!text || text.startsWith('http') || isAllowedUrl(text)) {
      setResults([])
      return
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/parcels/search.json?q=${encodeURIComponent(text)}&limit=8`)
      const d = await r.json()
      setResults(d.parcels || [])
    }, 300)
  }, [text])

  function onInput(e: any) {
    const v = e.target.value
    setText(v)
    setPicked(null)
    if (isAllowedUrl(v)) {
      onChange({ location_url: v })
      setPicked({ label: v, url: v })
      setResults([])
    } else {
      onChange({})
    }
  }

  function pick(p: Parcel) {
    setText(p.name)
    setResults([])
    setPicked({ label: p.name, url: `/parcels/${p.id}` })
    onChange({ parcel_id: p.id })
  }

  if (picked) {
    return (
      <div class="parcel-field">
        <a href={picked.url} target="_blank">
          {picked.label}
        </a>{' '}
        <a
          onClick={() => {
            setPicked(null)
            setText('')
            onChange({})
          }}
        >
          change
        </a>
      </div>
    )
  }

  return (
    <div class="parcel-field">
      <input type="text" value={text} onInput={onInput} placeholder="Search parcel name or paste a URL" />
      {results.length > 0 && (
        <ul>
          {results.map((p) => (
            <li key={p.id} onClick={() => pick(p)}>
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
