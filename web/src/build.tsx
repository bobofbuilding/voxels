/* globals fetch */

import { Component, Fragment } from 'preact'
import { blocks } from '../../common/content/blocks'
import { PanelType } from './components/panel'
import { app } from './state'

export interface Props {
  parcel?: any
  callback?: () => void
}

export interface State {
  open?: any
  material?: any
}

export default class BuildTab extends Component<Props, State> {
  constructor() {
    super()

    this.state = {
      open: false,
      material: blocks[0].value,
    }
  }

  get buildTypes() {
    return [
      { name: 'Empty', description: 'Empty (no voxels)', image: 'empty' },
      { name: 'Park', description: 'Randomly generated park', image: 'park' },
      { name: 'Outline', description: 'Outline of parcel', image: 'outline' },
      { name: 'ThreeTowers', description: 'Three randomly generated towers', image: 'towers' },
      { name: 'House', description: 'Solid block with four doors', image: 'house' },
      { name: 'Pyramid', description: 'Solid pyramid with path through it', image: 'pyramid' },
      { name: 'Scaffold', description: 'Scaffolding around the parcel', image: 'scaffold' },
    ]
  }

  get isSpace() {
    return !!this.props.parcel.spaceId
  }

  build(option: string) {
    if (confirm(`Are you sure you want to build ${option}?\n\nThis will destroy any existing content on the parcel`)) {
      return fetch(`/grid/${this.isSpace ? 'spaces' : 'parcels'}/${this.props.parcel.id}/build?function=${option}&material=${this.state.material}`, {
        method: 'POST',
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((r) => {
          this.setState({ open: false })

          if (r.success) {
            app.showSnackbar('✔️ Succeeded!', PanelType.Success)
            if (this.props.callback) {
              setTimeout(() => {
                this.props.callback?.()
              }, 1500)
            }
          } else {
            app.showSnackbar(r.error || 'Failed, please report!', PanelType.Danger)
          }
        })
    }
  }

  render() {
    const types = this.buildTypes.map((o) => {
      return (
        <a key={o.name} onClick={() => this.build(o.name)}>
          <h4>{o.name}</h4>
          <img src={`/images/build-${o.image}.png`} width={270} />
          <p>{o.description}</p>
        </a>
      )
    })

    const options = blocks.map((b) => (
      <option key={b.value} value={b.value}>
        {b.name.replace(/.png/, '')}
      </option>
    ))

    return (
      <Fragment>
        <button onClick={() => this.setState((prev) => ({ open: !prev.open }))}>View quick build</button>

        {this.state.open && (
          <div>
            <p>
              1. Choose material in the dropdown
              <br />
              2. Click an image to replace the current build with that template
            </p>
            <div>
              Build material: <select onChange={(e) => this.setState({ material: e.currentTarget['value'] })}>{options}</select>
            </div>
            <div>{types}</div>
          </div>
        )}
      </Fragment>
    )
  }
}
