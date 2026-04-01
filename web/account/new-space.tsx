import { Component } from 'preact'
import Head from '../src/components/head'
import { spaceName } from './faker'

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

export default class NewSpace extends Component<any, any> {
  constructor() {
    super()

    this.state = {
      placeholder: spaceName(),
      width: 16,
      height: 16,
      depth: 16,
    }
  }

  async submit(e: any) {
    e.preventDefault()

    const { width, height, depth, name } = this.state

    const body = JSON.stringify({
      name,
      width,
      height,
      depth,
    })

    const f = await fetch('/spaces/create', { credentials: 'include', headers, method: 'post', body })
    const r = await f.json()

    window.location.replace(`/spaces/${r.id}`)
  }

  rollName = (e: any) => {
    const name = spaceName()

    this.setState({ name })

    e.preventDefault()
  }

  render() {
    return (
      <section>
        <Head title={'Create Space'}></Head>

        <h1>Create Space</h1>

        <form onSubmit={(e) => this.submit(e)}>
          <div class="grid">
            <div>
              <div>
                <label htmlFor={'space-name'}>Name</label>
                <input name="space-name" size={52} type="text" placeholder={`eg ${this.state.placeholder}`} value={this.state.name} onInput={(e) => this.setState({ name: (e as any).target['value'] })} />
                <button onClick={this.rollName}>🎲</button>
              </div>
            </div>
            <div>
              <div>
                <label htmlFor={'space-name'}>Size</label>
                {this.state.width}&times;{this.state.depth}&times;{this.state.height}
              </div>

              <div>
                <label htmlFor={'space-width'}>Width</label>
                <input name="space-width" type="range" min={4} max={32} step={1} value={this.state.width} onChange={(e) => this.setState({ width: (e as any).target['value'] })} />
                {this.state.width} <small>meters</small>
              </div>

              <div>
                <label htmlFor={'space-height'}>Height</label>
                <input name={'space-height'} type="range" min={4} max={32} step={1} value={this.state.height} onChange={(e) => this.setState({ height: (e as any).target['value'] })} />
                {this.state.height} <small>meters</small>
              </div>
              <div>
                <label htmlFor={'space-depth'}>Depth</label>
                <input name="space-depth" type="range" min={4} max={32} step={1} value={this.state.depth} onChange={(e) => this.setState({ depth: (e as any).target['value'] })} />
                {this.state.depth} <small>meters</small>
              </div>
            </div>
          </div>
          <p>
            <button disabled={!this.state.name}>Create!</button>
          </p>
        </form>
      </section>
    )
  }
}
