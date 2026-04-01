import { Component } from 'preact'

interface Props {
  type?: string
  title?: string
  className?: string
}

export enum PanelType {
  Warning = 'warning',
  Info = 'info',
  Danger = 'danger',
  Success = 'success',
  Help = 'help',
}

export default class Panel extends Component<Props> {
  get classname() {
    switch (this.props.type) {
      case PanelType.Success:
        return 'is-success'
      case PanelType.Info:
        return 'is-info'
      case PanelType.Help:
        return 'is-help'
      case PanelType.Warning:
        return 'is-warning'
      case PanelType.Danger:
        return 'is-danger'
      default:
        return 'is-info'
    }
  }

  render() {
    return (
      <div className={`panel ${this.classname} ${this.props.className ?? ''}`}>
        <div>{this.props.title ?? ''}</div>
        <div>{this.props.children}</div>
      </div>
    )
  }
}
