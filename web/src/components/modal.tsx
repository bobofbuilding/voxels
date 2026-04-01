import { Component } from 'preact'

export interface Props {
  className?: string
  onCloseModal?: Function
}

export default class Modal extends Component<any, any> {
  render() {
    return (
      <div title="">
        <div className={`modal-content ${!!this.props.className && this.props.className}`}>{this.props.children}</div>
      </div>
    )
  }
}
