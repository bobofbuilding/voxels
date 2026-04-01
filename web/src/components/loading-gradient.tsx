import { Component } from 'preact'

export default class LoadingGradient extends Component<any, any> {
  render() {
    return (
      <div style={{ width: this.props.width || '100%', height: this.props.height || 30 }} title="loading...">
        <p>{this.props.children}</p>
      </div>
    )
  }
}
