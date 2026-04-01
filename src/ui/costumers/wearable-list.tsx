import { Component, Fragment } from 'preact'
import { getWearableGif } from '../../../web/src/helpers/wearable-helpers'
import { app } from '../../../web/src/state'
import { CollectiblesData, fetchUsersCollectiblesData } from '../../../common/helpers/collections-helpers'

type WearableListState = {
  wearables: CollectiblesData[]
  loading: boolean
}

export default class WearableList extends Component<any, WearableListState> {
  queries = 0
  state: WearableListState = {
    wearables: [],
    loading: true,
  }

  render() {
    const wearables = this.state.wearables.map((wearable) => {
      const ondragstart = (e: DragEvent) => {
        e.dataTransfer?.setData('text/plain', 'boop')
        e.stopImmediatePropagation()

        if (e.target && e.target instanceof HTMLElement) {
          e.target.className = 'dragging-wearable'
        }

        // @ts-expect-error global abuse for drag drop
        window['droppedWearable'] = wearable
      }

      const ondragend = (e: DragEvent) => {
        if (e.target && e.target instanceof HTMLElement) {
          e.target.className = 'draggable-wearable'
        }
      }

      const onClick = () => {
        app.showSnackbar('Drag and drop wearables onto your avatar to attach')
      }

      let alt = `wearable #${wearable.id}`
      if (wearable.name) {
        alt = wearable.name
      }
      if (wearable.description) {
        alt += '\n\n' + wearable.description
      }

      return (
        <div class="wearable" key={wearable.id} onDragStart={ondragstart} onDragEnd={ondragend} onClick={onClick} draggable={true} title={alt}>
          <img width={94} height={94} src={getWearableGif(wearable)} alt={alt} />
          <p>{wearable.name}</p>
        </div>
      )
    })

    return (
      <Fragment>
        <h3>Wearables</h3>
        <div></div>
        <div class="wearables">{wearables}</div>
      </Fragment>
    )
  }

  async fetch() {
    if (!app.state.wallet) {
      console.error('Can not fetch Wearables. No wallet')
      return
    }
    this.setState({ loading: true })
    const wearables = await fetchUsersCollectiblesData(app.state.wallet)
    wearables.sort((w1, w2) => w1.name.localeCompare(w2.name))
    this.setState({ loading: false, wearables })
  }

  componentDidMount() {
    this.fetch().catch(console.error.bind(console))
  }
}
