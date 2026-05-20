import { Component } from 'preact'
import Head from '../src/components/head'

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const SIZES = [
  { label: '8 x 8 x 8', w: 8, h: 8, d: 8 },
  { label: '16 x 16 x 16', w: 16, h: 16, d: 16 },
  { label: '24 x 24 x 24', w: 24, h: 24, d: 24 },
  { label: '32 x 32 x 32', w: 32, h: 32, d: 32 },
  { label: '48 x 32 x 48', w: 48, h: 32, d: 48 },
  { label: '64 x 32 x 64', w: 64, h: 32, d: 64 },
  { label: 'Custom', w: null, h: null, d: null },
]

export default class NewSpace extends Component<any, any> {
  state = { name: '', width: 16, height: 16, depth: 16, size: '16 x 16 x 16', environment: 'day' }

  async submit(e: any) {
    e.preventDefault()
    const { width, height, depth, name, environment } = this.state
    const f = await fetch('/spaces/create', { credentials: 'include', headers, method: 'post', body: JSON.stringify({ name, width, height, depth, environment }) })
    const r = await f.json()
    window.location.replace(`/spaces/${r.id}`)
  }

  setSize(label: string) {
    const s = SIZES.find((s) => s.label === label)
    if (!s) return
    this.setState({ size: label, ...(s.w !== null ? { width: s.w, height: s.h, depth: s.d } : {}) })
  }

  render() {
    const custom = this.state.size === 'Custom'
    return (
      <section>
        <Head title={'Create Space'}></Head>

        <h1>Create Space</h1>

        <form onSubmit={(e) => this.submit(e)}>
          <div class="f">
            <label>Name</label>
            <input type="text" value={this.state.name} onInput={(e) => this.setState({ name: (e as any).target['value'] })} />
          </div>
          <div class="f">
            <label>Size</label>
            <select value={this.state.size} onChange={(e) => this.setSize((e as any).target['value'])}>
              {SIZES.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {custom && (
            <>
              <div class="f">
                <label>Width</label>
                <input type="range" min={4} max={64} step={1} value={this.state.width} onChange={(e) => this.setState({ width: parseInt((e as any).target['value']) })} />
                {this.state.width} <small>m</small>
              </div>
              <div class="f">
                <label>Height</label>
                <input type="range" min={4} max={64} step={1} value={this.state.height} onChange={(e) => this.setState({ height: parseInt((e as any).target['value']) })} />
                {this.state.height} <small>m</small>
              </div>
              <div class="f">
                <label>Depth</label>
                <input type="range" min={4} max={64} step={1} value={this.state.depth} onChange={(e) => this.setState({ depth: parseInt((e as any).target['value']) })} />
                {this.state.depth} <small>m</small>
              </div>
            </>
          )}
          <div class="f">
            <label>Environment</label>
            <select value={this.state.environment} onChange={(e) => this.setState({ environment: (e as any).target['value'] })}>
              <option value="day">Day</option>
              <option value="night">Night</option>
              <option value="void">Void</option>
            </select>
          </div>
          <button disabled={!this.state.name}>Create Space</button>
        </form>
      </section>
    )
  }
}
