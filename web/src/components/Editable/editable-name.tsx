import Editable, { AssetType } from './editable'

export default class EditableName extends Editable {
  constructor(props: any) {
    super(props)
  }

  get isSpaceHomePage() {
    return !!this.props.path && this.props.path.match('/spaces')
  }

  defaultValue() {
    switch (this.type) {
      case AssetType.Parcel:
        return this.props.data.address
      case AssetType.Space:
        /* Space name */
        return this.props.data.name
      case AssetType.Costume:
        /* costume name */
        return this.props.data.name
      case AssetType.Snapshot:
        /* snapshot name */
        return this.props.data.snapshot_name
      case AssetType.Collectible:
        /* snapshot name */
        return this.props.data.name
    }
  }

  generateContent() {
    if (this.state.value === '' || this.state.value === ' ') {
      this.setState({ value: this.defaultValue() })
    }

    if (this.type !== AssetType.Snapshot) {
      return { name: this.state.value!.toString() }
    } else {
      return { name: this.state.value!.toString(), version: this.props.data }
    }
  }

  getElementType() {
    switch (this.type) {
      case AssetType.Parcel:
        return <h1>{this.state.value}</h1>
      case AssetType.Space:
        /* Space name */
        if (this.isSpaceHomePage) {
          return <h1>{this.state.value}</h1>
        }
        return <b>{this.state.value}</b>
      case AssetType.Costume:
        /* costume name */
        return (
          <b style={{ margin: 'auto 0 auto', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => this.props.onclick?.(this.props.data.id)}>
            {this.props.active && '» '}
            {this.state.value}
          </b>
        )
      case AssetType.Snapshot:
        return (
          <h2 style={{ maxWidth: '70%' }}>
            <a onClick={() => {}}>{this.state.value}</a>
          </h2>
        )
      case AssetType.Collectible:
        return <b>{this.state.value}</b>
      default:
        return null!
    }
  }

  getInputType() {
    return (
      <input
        className={this.props.className}
        placeholder={this.defaultValue()}
        autofocus
        type="text"
        title={this.props.title || ''}
        value={this.state.value}
        onKeyUp={(e) => this.isEnterKey(e)}
        onChange={(e) => this.setState({ value: (e as any).target['value'] })}
      />
    )
  }

  render() {
    return !this.state.isEditing ? (
      this.getElementType()
    ) : (
      <div style="display: flex; align-items: center; column-gap: 1rem;">
        {this.getInputType()} {this.showIcons()}
      </div>
    )
  }
}
