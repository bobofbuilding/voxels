import { Component } from 'preact'
import { Assetish } from '../asset'
import { route } from 'preact-router'
import LoadingPage from '../loading-page'
import { JsonEditor } from 'json-edit-react'
import Ajv from 'ajv'
import { invalidateUrl } from '../helpers/cached-fetch'

export interface Props {
  path?: string
  id?: any
}

export interface State {
  asset?: Assetish
  categories?: string[]
}

export default class EditAsset extends Component<Props, State> {
  ajv = new Ajv()
  validate: any

  fetch = async () => {
    invalidateUrl(`/api/asset/*`)

    var f = await fetch(`/api/assets/${this.props.id}`)
    var { asset } = await f.json()
    this.setState({ asset })

    f = await fetch(`/api/assets/categories`)
    var { categories } = await f.json()
    this.setState({ categories })

    f = await fetch(`/api/assets/schema`)
    var { schema } = await f.json()
    this.validate = this.ajv.compile(schema)
  }

  onUpdate = ({ newData }: { newData: any }) => {
    if (!this.validate) {
      return
    }

    const valid = this.validate(newData)

    console.log(valid, this.validate)

    if (!valid) {
      console.log('Errors', this.validate.errors)
      const errorMessage = this.validate.errors?.map((error: any) => `${error.instancePath}${error.instancePath ? ': ' : ''}${error.message}`).join('\n')
      console.log({
        title: 'Not compliant with JSON Schema',
        description: errorMessage,
        status: 'error',
      })

      return
    }
  }

  onSave = async (e: any) => {
    e.preventDefault()

    const f = await fetch(`/api/assets/${this.props.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        credentials: 'include',
      },
      body: JSON.stringify(this.state.asset),
    })

    if (f.ok) {
      route(`/assets/${this.props.id}`)
    }
  }

  componentDidMount() {
    this.fetch()
  }

  private set(key: string, value: string) {
    this.setState({ asset: { ...this.state.asset!, [key]: value } })
  }

  render() {
    const categories = this.state.categories?.map((c) => <option value={c}>{c}</option>)

    if (!this.state.asset) {
      return <LoadingPage />
    }

    return (
      <section>
        <article>
          <h1>Edit Asset</h1>

          <form onSubmit={this.onSave}>
            <div class="f">
              <label>Name</label>
              <input type="text" value={this.state.asset.name} onChange={(e: any) => this.set('name', e.target.value)} />
            </div>

            <div class="f">
              <label>Description</label>
              <textarea value={this.state.asset.description} onChange={(e: any) => this.set('description', e.target.value)} rows={10} />
            </div>

            <div class="f">
              <label>Category</label>
              <select value={this.state.asset.category} onChange={(e: any) => this.set('category', e.target.value)}>
                {categories}
              </select>
            </div>

            <div class="f">
              <label>Content</label>
              <JsonEditor data={this.state.asset.content} setData={(e: any) => this.set('content', e)} />
            </div>

            <div class="f">
              <button type="submit">Save</button>
            </div>
          </form>
        </article>
      </section>
    )
  }
}
