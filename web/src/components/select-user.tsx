import { useEffect, useRef, useState } from 'preact/hooks'

type Result = { name: string; wallet: string }

type Props = {
  onSelect: (wallet: string) => void
}

export default function SelectUser({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const timer = useRef<any>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/avatars/search?q=${encodeURIComponent(query)}`)
      if (r.ok) setResults(await r.json())
    }, 250)
    return () => clearTimeout(timer.current)
  }, [query])

  function pick(wallet: string) {
    onSelect(wallet)
    setQuery('')
    setResults([])
  }

  return (
    <div class="select-user">
      <div class="f">
        <input
          type="text"
          placeholder="name or wallet address"
          value={query}
          onInput={(e: any) => setQuery(e.target.value)}
          onKeyDown={(e: any) => {
            if (e.key === 'Enter' && query.trim()) {
              e.preventDefault()
              pick(results[0]?.wallet ?? query.trim())
            }
          }}
        />
        {!results.length && query.trim() && (
          <button type="button" onClick={() => pick(query.trim())}>
            Add
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li key={r.wallet}>
              <button type="button" onClick={() => pick(r.wallet)}>
                {r.name || r.wallet} <small>{r.wallet.substring(0, 10)}...</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
