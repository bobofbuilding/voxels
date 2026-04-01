import { Component } from 'preact'
import ParcelHelper from '../../../common/helpers/parcel-helper'
import { ssrFriendlyDocument, ssrFriendlyWindow } from '../../../common/helpers/utils'
import { SimpleSpaceRecord } from '../../../common/messages/space'
import { truncate } from '../lib/string-utils'
import SpaceHelper from '../space-helper'
import { fetchOptions } from '../utils'

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

interface Props {
  record: any
  helper: ParcelHelper
  teleportTo?: (coords: string) => void
}

interface State {
  collapsed?: boolean
}

export default class PropertyItem extends Component<Props, State> {
  state = { collapsed: true }

  onClick(event: MouseEvent) {
    if (!this.props.teleportTo) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    this.teleport(this.props.helper)
  }

  render() {
    return (
      <tr>
        <td>
          <a href={'/parcels/' + this.props.record.id} onClick={this.onClick.bind(this)}>
            #{this.props.record.id}
          </a>
        </td>
        <td>
          <b>
            <a href={'/parcels/' + this.props.record.id} onClick={this.onClick.bind(this)}>
              {truncate(this.props.record.name || this.props.record.address, 80)}
            </a>
          </b>
          <br />
          <small>{this.props.helper.island}</small>
        </td>
        <td>{this.props.record.emoji_list ? this.props.record.emoji_list.map((e: { emoji: string; total: number }) => e.emoji + e.total + ' ') : ''}</td>
      </tr>
    )
  }

  private teleport(p: ParcelHelper) {
    const isSpace = (): boolean => !!ssrFriendlyDocument?.location.toString()?.match('/spaces')
    p.spawnUrl().then((url) => {
      if (isSpace() && ssrFriendlyWindow) {
        ssrFriendlyWindow.location.href = url
      } else {
        this.props.teleportTo?.(url)
      }
    })
  }
}

interface SpaceProps {
  record: SimpleSpaceRecord
  spaceHelper: SpaceHelper
  onRemove?: () => void
}

export class SpacePropertyItem extends Component<SpaceProps, State> {
  constructor(props: SpaceProps) {
    super(props)
    this.state = {
      collapsed: true,
    }
  }

  get helper() {
    return this.props.spaceHelper
  }

  removeSpace = () => {
    const id = this.helper.id
    const body = JSON.stringify({ id })

    if (confirm(`Are you sure you want to remove space ${this.helper.name} ?`)) {
      fetch('/spaces/remove', { credentials: 'include', headers, method: 'post', body })
        .then((f) => f.json())
        .then((r) => {
          if (r.success) {
            this.props.onRemove?.()
          }
        })
    }
  }

  downloadJson() {
    fetch(`${process.env.API}/spaces/${this.helper.id}.json`, fetchOptions())
      .then((r) => r.json())
      .then((r) => {
        const versionJSON = r.space

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(versionJSON))
        let dlLink = document.getElementById('downloadAnchorElem')
        if (!dlLink) {
          dlLink = document.createElement('a')
          dlLink.id = 'downloadAnchorElem'
          dlLink.style.display = 'none'
          document.body.appendChild(dlLink)
        }
        const dlAnchorElem = dlLink
        dlAnchorElem.setAttribute('href', dataStr)
        dlAnchorElem.setAttribute('download', `${this.helper.id}.json`)
        dlAnchorElem.click()
      })
  }

  render() {
    return (
      <tr>
        <td>
          <small title={this.props.record.id}>
            #{`${this.props.record.id}`.slice(0, 2)}&#8230;{`${this.props.record.id}`.slice(-2)}
          </small>
        </td>
        <td>
          <div />
        </td>
        <td>
          <b>
            <a href={`/spaces/${this.helper.id}`}>{this.helper.name}</a>
          </b>
          <br />
          {'width' in this.props.record && 'depth' in this.props.record && (
            <small>
              {this.props.record.width}&times;{this.props.record.height}&times;{this.props.record.depth}
            </small>
          )}
          <br />
          <a onClick={() => this.removeSpace()}>Remove</a>
        </td>
      </tr>
    )
  }
}
