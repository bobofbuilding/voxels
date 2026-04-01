import { Component, Fragment } from 'preact'
import { ssrFriendlyWindow } from '../../common/helpers/utils'
import Head from './components/head'
import PaginationLinks from './components/pagination-links'
import cachedFetch from './helpers/cached-fetch'
import parse from './helpers/parse'

import { app } from './state'

type SpaceRecord = {
  id: string
  name: string | null
  owner_name: string | null
  visits: number | null
  feature_count: number | null
  pagination_count: number
}

export interface Props {
  spaces?: Array<SpaceRecord>
  path?: string
  page?: any
  matches?: any
}

export interface State {
  spaces?: Array<SpaceRecord>
  page: number
  loading: boolean
  total?: number
}

export default class Spaces extends Component<Props, State> {
  controller: any

  constructor(props: any) {
    super()

    const page = (props.page && parseInt(props.page, 10)) || 1

    this.state = {
      page,
      ...(props.spaces ? { spaces: props.spaces, total: this.getPageCount(props.spaces), loading: false } : { loading: true }),
    }
  }

  get spaces() {
    return this.state.spaces || []
  }

  get queryParams(): URLSearchParams | undefined {
    return ssrFriendlyWindow ? new URLSearchParams(document.location.search.substring(1)) : undefined
  }

  get owner() {
    return this.queryParams && parse.ethaddress(this.queryParams.get('owner'))
  }

  componentDidMount() {
    this.fetch()
  }

  componentWillUnmount() {
    if (this.controller) {
      this.controller.abort('ABORT: quitting component')
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    const page = (nextProps.page && parseInt(nextProps.page, 10)) || 1
    this.setState({ page }, this.fetch.bind(this))
  }

  async fetch() {
    if (this.controller) {
      this.controller.abort('ABORT:fetching')
      this.controller = null
    }

    this.setState({ loading: true, spaces: [] })

    const page = this.state.page
    let url

    if (this.owner) {
      url = `/api/wallet/${this.owner}/spaces.json?page=${page}`
    } else {
      url = `/api/spaces.json?page=${page}`
    }

    const r = await cachedFetch(url, {}, 120)
    const { spaces } = await r.json()

    const total = this.getPageCount(spaces)
    this.setState({ spaces, total, loading: false })

    this.forceUpdate()
  }

  render() {
    const spaces = this.spaces.map((s) => {
      const name = s.name || s.id

      return (
        <tr>
          <td>&nbsp;</td>
          <td>
            <b>
              <a href={`/spaces/${s.id}`}>{name}</a>
            </b>
            <br />
            <small>{s.owner_name}</small>
          </td>
          <td>{s.visits}</td>
          <td>{s.feature_count}</td>
        </tr>
      )
    })

    const description = this.owner ? `created by ${this.owner}` : null

    return (
      <section>
        <Head title={'Spaces'} />

        <div style={{ display: 'flex', flex: 1, width: '100%' }}>
          <hgroup style={{ flexGrow: 1 }}>
            <h1>Spaces</h1>
            <p>Browse the public spaces.</p>
          </hgroup>
          <div>
            {app.state.wallet && (
              <button class="outline" onClick={() => (window.location.href = '/spaces/new')}>
                + Create
              </button>
            )}
          </div>
        </div>

        {this.state.loading ? (
          <div />
        ) : (
          <Fragment>
            <PaginationLinks path="/spaces" total={this.state.total} page={this.state.page} limit={100} description={description} queryParams={this.queryParams} />

            <table class="spaces-table">
              <thead>
                <tr>
                  <th>&nbsp;</th>
                  <th>Name</th>
                  <th>Visitors</th>
                  <th>Features</th>
                </tr>
              </thead>
              <tbody>{spaces}</tbody>
            </table>
            <PaginationLinks path="/spaces" total={this.state.total} page={this.state.page} limit={100} description={description} queryParams={this.queryParams} />
          </Fragment>
        )}
      </section>
    )
  }

  private getPageCount(spaces: SpaceRecord[]) {
    return spaces.length > 0 ? spaces[0].pagination_count : 0
  }
}
