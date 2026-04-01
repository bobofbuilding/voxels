import { Component } from 'preact'
import { route } from 'preact-router'
import { v7 as uuidv7 } from 'uuid'
import { Costume } from '../../common/messages/costumes'
import { loadingBox } from '../src/components/loading-icon'
import { PanelType } from '../src/components/panel'
import cachedFetch from '../src/helpers/cached-fetch'
import { app } from '../src/state'
import { fetchOptions } from '../src/utils'

const ContentType = 'application/json'
const fetchParams = {
  headers: { Accept: ContentType, 'Content-Type': ContentType },
  credentials: 'include',
} as const

export interface Props {}

export interface State {
  costumes: Costume[]
  loading: boolean
}

export default class CostumeList extends Component<Props, State> {
  state: State = { costumes: [], loading: false }

  componentDidMount() {
    this.fetch()
  }

  get wallet() {
    return app.state.wallet
  }

  async fetch() {
    this.setState({ loading: true })
    const opts = fetchOptions()

    const r = await cachedFetch(`/api/costumes/by/${this.wallet}`, opts)
    const costumes: Costume[] = (await r.json()).costumes || []

    this.setState({ costumes, loading: false })
  }

  createCostume = async (costume: Event | null | Partial<Costume>) => {
    if (!costume || costume instanceof Event) {
      let id = 1

      if (this.state.costumes) {
        const numbers = this.state.costumes.map((c) => parseInt(`${c.name}`.split('-')[1], 10) || 0)
        id = Math.max(...numbers) + 1

        if (!id || isNaN(id) || !isFinite(id)) {
          id = 1
        }
      }

      costume = { name: `Costume-${id}` }
    }

    const body = JSON.stringify(costume)
    const createResponse = await fetch(`/api/costumes/create`, { ...fetchParams, method: 'POST', body })
    if (!createResponse.ok) {
      app.showSnackbar('Could not create costume, please retry', PanelType.Warning)
      console.error('Error response from server when trying to create costume...')
      return
    }

    const createdCostume = await createResponse.json()

    if (!createdCostume || !createdCostume.success) {
      console.error('Could not create costume')
      app.showSnackbar('Could not create new costume, please retry', PanelType.Warning, 7500)
      return
    }
    await this.fetch()

    app.showSnackbar('Costume created', PanelType.Info)

    route(`/costumer/${createdCostume.id}`, true)
  }

  onUpload = async (e: Event) => {
    const input = e.target
    if (!input || !(input instanceof HTMLInputElement)) {
      console.warn('invalid input', input)
      return
    }

    if (!input.files || input.files.length == 0) {
      console.warn('no files', input.files)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const r = e.target?.result ?? ''
      if (typeof r != 'string') {
        console.warn('invalid result', r)
        return
      }

      const j = JSON.parse(r) as Partial<Costume & { wallet: string }>

      delete j.wallet
      delete j.id

      if (j.attachments) {
        // What the heck is this == ???
        j.attachments.forEach((a) => a.uuid == uuidv7())
      }

      this.createCostume(j)
    }

    reader.readAsText(input.files[0])
  }

  render() {
    if (this.state.loading) {
      return loadingBox()
    }

    return (
      <section class="columns profile">
        <h1>Costumes</h1>

        <article>
          <table>
            <tbody>
              {this.state.costumes.map((c) => (
                <tr>
                  <td>
                    <a href={`/costumer/${c.id}`}>{c.name ?? `costume#${c.id}`}</a>
                  </td>
                  <td>{c.attachments?.length ?? 0} wearables</td>
                  <td>{c.default_color}</td>
                  <td>
                    <button>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <aside>
          <h3>Create</h3>

          <p>
            <button onClick={this.createCostume}>New Costume</button>
          </p>

          <h3>Upload</h3>
          <form>
            <input onChange={this.onUpload} type="file" />
            <button>Upload</button>
          </form>
        </aside>
      </section>
    )
  }
}
