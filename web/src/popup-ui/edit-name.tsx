import { Component, render } from 'preact'
import { app, AppEvent } from '../state'

import Panel, { PanelType } from '../components/panel'
import { isInWorld } from '../../../common/helpers/detector'
import { isHexString } from 'ethers'
import { Spinner } from '../spinner'

export interface Props {
  onClose: () => void
  onNewName?: (cacheBust?: boolean) => void
}

export interface EditWindowProps {}

export interface State {
  saving: boolean
  loading: boolean
  name?: string
  selectedName: string | null
  color?: string
  error?: string
  names: string[]
  advanced?: boolean
}

export default class EditName extends Component<EditWindowProps, State> {
  static currentElement: Element

  constructor(props: EditWindowProps) {
    super(props)

    this.state = {
      loading: true,
      advanced: false,
      saving: false,
      color: '#ffffff',
      names: [],
      error: null!,
      selectedName: app.state.name ?? null,
    }
  }

  get persona() {
    return window.persona
  }

  setStateAsync(state: Partial<State>): Promise<void> {
    return new Promise((resolve) => {
      this.setState(state, resolve)
    })
  }

  onSignIn = () => {
    this.fetchNames()
  }

  componentDidMount() {
    this.fetchNames()
    app.on(AppEvent.Login, this.onSignIn)
  }

  componentWillUnmount() {
    app.removeListener(AppEvent.Login, this.onSignIn)
  }

  async setName(name: string) {
    if (name === app.state.name) {
      this.setState({ selectedName: name })
      return
    }
    this.setState({ saving: true })
    const hasName = this.state.names.includes(name)

    if (!hasName) {
      this.setState((s) => ({ names: [...s.names, name] }))
    }

    const req = await fetch(`/api/avatar`, {
      method: 'post',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    })
    const r = await req.json()
    this.hideSaving()

    if (!r.success) {
      this.setState({ saving: false, error: 'Could not save new name, please try again' })
    } else {
      this.setState({ saving: false, selectedName: name })
      app.setName(name)
      if (!isHexString(name)) {
        isInWorld() && this.persona.connector.reconnect()
        app.showSnackbar('Name saved!', PanelType.Success)
      }
      this.onSetName()
    }
  }

  hideSaving() {
    this.setState({ saving: false })
  }

  async fetchNames() {
    await this.setStateAsync({ loading: true })
    const r = await app.fetchNames()
    const names = r.names || []

    await this.setStateAsync({ names, loading: false })

    if (app.state.name) {
      this.setName(app.state.name)
    } else if (r.name) {
      this.setName(r.name)
    }
  }

  onSetName = () => {
    // virtual
  }

  render() {
    const ensInfo = 'https://ens.domains/'

    if (this.state.loading) {
      return <Spinner size={16} />
    }

    return (
      <form>
        {this.state.saving && <p>Saving selected name...</p>}
        {this.state.error && <p>{this.state.error}</p>}

        <div class="f">
          <label>Names</label>
          <NamesDropDown {...this.state} setName={(name) => this.setName(name)} /> <br />
          <small>
            (Hint: If you own an <a href={ensInfo}>ENS name</a> - configure 'reverse resolution' to make it available in voxels)
          </small>
        </div>
        <div class="f">
          <button title="Refresh" onClick={() => this.fetchNames()}>
            Refresh
          </button>
        </div>
      </form>
    )
  }
}

function NamesDropDown(props: { names: string[]; selectedName: string | null; setName: (name: string) => void }) {
  const { selectedName, names, setName } = props
  return (
    <select value={selectedName ?? undefined} onInput={(e) => setName((e as any).target['value'])}>
      {names!.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}
