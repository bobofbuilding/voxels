import { maxBy } from 'lodash'
import { Component } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { v7 as uuid } from 'uuid'
import Panel, { PanelType } from './panel'

const DEFAULT_SNACK_TIMEOUT = 2500

type snackbarRecord = { message: string; type: PanelType; time: number; displayTime: number; onClick?: () => void }
export default class Snackbar extends Component<object, object> {
  static Element: HTMLElement
  static instance: Snackbar
  snackbarMap: Map<string, snackbarRecord> = new Map()

  constructor() {
    super()
    Snackbar.instance = this
  }

  static get default() {
    return { message: '', type: PanelType.Info }
  }

  static show(message: string | Error = '', type = PanelType.Info, displayTime = DEFAULT_SNACK_TIMEOUT, onClick?: () => void) {
    console.log(message)

    if (!Snackbar.instance) {
      return
    }

    const newEntry: snackbarRecord = {
      message: typeof message !== 'string' ? message.toString() : message,
      type,
      time: Date.now(),
      displayTime,
      onClick,
    }
    const id = uuid()
    Snackbar.instance.snackbarMap.set(id, newEntry)
    if (Snackbar.instance.snackbarMap.size > 5) {
      // if we have heaps of snackbars being shown, nerf the oldest one instantly.
      Snackbar.instance.clearOldestItem()
    }
    Snackbar.instance.forceUpdate()
  }

  clearOldestItem = () => {
    const item = maxBy(Array.from(this.snackbarMap.entries()), ([_, value]) => value.time)
    if (!item) {
      return
    }
    this.snackbarMap.delete(item[0])
  }

  onExpire = (id: string) => {
    this.snackbarMap.delete(id)
    this.forceUpdate()
  }

  render() {
    return (
      <div class="SnackbarsContainer">
        {Array.from(this.snackbarMap.entries()).map(([key, value]) => (
          <SnackbarItem key={key} id={key} message={value.message} type={value.type} onExpire={this.onExpire} displayTime={value.displayTime} onClick={value.onClick} />
        ))}
      </div>
    )
  }
}

interface SnackbarItemProps {
  id: string
  message: string
  type?: PanelType
  displayTime?: number
  onExpire: (id: string) => void
  onClick?: () => void
}

export const SnackbarItem = ({ id, message, type, onExpire, displayTime, onClick }: SnackbarItemProps) => {
  const [msg, setMsg] = useState<string>(message)

  const hide = () => {
    setMsg('')
    // remove item after x seconds
    setTimeout(() => onExpire(id), 1000)
  }
  useEffect(() => {
    // hide after x seconds
    const t = setTimeout(() => hide(), displayTime ?? DEFAULT_SNACK_TIMEOUT)
    return () => {
      clearTimeout(t)
    }
  }, [])

  return (
    <div className={`snackbar ${msg ? 'show' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <Panel type={type}>{msg}</Panel>
    </div>
  )
}
