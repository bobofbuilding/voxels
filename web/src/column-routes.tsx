import { useEffect, useState } from 'preact/hooks'
import { AvatarTab } from '../../src/ui/avatar-tab'
import { SettingsUI } from '../../src/ui/settings'

function useWorldReady() {
  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.ui)
  useEffect(() => {
    if (window.ui) {
      setReady(true)
      return
    }
    const id = setInterval(() => {
      if (!window.ui) return
      setReady(true)
      clearInterval(id)
    }, 100)
    return () => clearInterval(id)
  }, [])
  return ready
}

export function AvatarPage(_props: { path?: string }) {
  if (!useWorldReady()) return null
  return <AvatarTab />
}

export function SettingsPage(_props: { path?: string }) {
  const ready = useWorldReady()
  const ui = window.ui
  if (!ready || !ui) return null
  return <SettingsUI scene={ui.props.scene} minimapSettings={ui.props.minimapSettings} />
}
