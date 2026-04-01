import { Component, createRef } from 'preact'

export interface Props {
  value: string | null
  onSave?: any
}

export interface State {
  value?: string | null
  editing: boolean
}

export default class EditableName extends Component<Props, State> {
  ref = createRef()

  constructor(props: any) {
    super(props)
  }

  isEnterKey(event: any) {
    if (event.key === 'Enter') {
      this.save()
    }
  }

  save = async () => {
    await this.setState({ editing: false })
    this.props.onSave(this.state.value)
  }

  onEdit = async () => {
    await this.setState({ editing: true, value: this.props.value })

    setTimeout(() => {
      if (this.ref.current) {
        this.ref.current.focus()
      }
    }, 5)
  }

  onCancel = async () => {
    await this.setState({ editing: false, value: this.props.value })
  }

  render() {
    if (this.state.editing) {
      return (
        <div class="header">
          <h1 class="editable">
            <input autofocus ref={this.ref} type="text" value={this.state.value!} onKeyUp={(e) => this.isEnterKey(e)} onChange={(e) => this.setState({ value: (e as any).target['value'] })} />
          </h1>

          <p>
            <a title="Save" onClick={this.save}>
              Save
            </a>{' '}
            or{' '}
            <a title="Cancel" onClick={this.onCancel}>
              Cancel
            </a>
          </p>
        </div>
      )
    } else {
      return (
        <h1>
          <span onClick={this.onEdit} class="editable" title="Click to edit">
            {this.props.value}
          </span>
        </h1>
      )
    }
  }
}
