import { Component } from 'preact'
import { WompRecord } from '../../common/messages/feature'

interface Props {
  womps: WompRecord[]
  callback?: (url: string) => void
  returnWomp?: (w: WompRecord) => void
}

interface State {
  collapsed: boolean
}

export class WompCatalog extends Component<Props, State> {
  constructor() {
    super()
    this.state = {
      collapsed: false,
    }
  }

  onClick(womp: any) {
    this.props.returnWomp && this.props.returnWomp(womp)
    this.props.callback && this.props.callback(womp.image_url)
  }

  render() {
    const womps = this.props.womps.map((womp: WompRecord) => (
      <a onClick={() => this.onClick(womp)}>
        <img src={womp.image_url} width={20} height={20} title={womp.coords} />
      </a>
    ))

    return (
      <div>
        <div className={`collapsible ${this.state.collapsed ? 'collapsed' : ''}`}>
          <div className="category-models">{womps && womps.length == 0 ? 'No womps found, go explore and capture some womps!' : womps}</div>
        </div>
      </div>
    )
  }
}
