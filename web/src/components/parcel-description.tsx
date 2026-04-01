import { Component } from 'preact'
import EditableDescription from './Editable/editable-description'
import { app } from '../state'
import { AssetType } from './Editable/editable'
import { PanelType } from './panel'
import ParcelHelper from '../../../common/helpers/parcel-helper'
import { SingleParcelRecord } from '../../../common/messages/parcel'

export interface Props {
  parcel: SingleParcelRecord
}

export interface State {
  parcel: SingleParcelRecord
  description?: string | null
}

export default class ParcelDescription extends Component<Props, State> {
  constructor(props: Props) {
    super()
    this.state = {
      parcel: props.parcel,
      description: props.parcel.description,
    }
  }

  get isOwner() {
    const h = new ParcelHelper(this.state.parcel)
    return h.isOwner(app.state.wallet || '')
  }

  componentDidMount() {
    this.refresh()
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.parcel.id != this.props.parcel.id || this.props.parcel.description !== prevProps.parcel.description) {
      this.refresh()
    }
  }

  refresh = () => {
    if (!this.props.parcel) {
      return
    }
    this.setState({
      parcel: this.props.parcel,
      description: this.props.parcel.description,
    })
  }

  descriptionValidator = (value: string) => {
    if (!value) {
      return true
    }
    // arbitrary
    if (value.length > 500) {
      app.showSnackbar('Description is more than 500 characters', PanelType.Danger)
      return false
    }
    return true
  }

  render() {
    if (!this.state.parcel) {
      return <div></div>
    }

    return (
      <div>
        <EditableDescription value={this.state.description ?? ''} validationRule={this.descriptionValidator} isowner={this.isOwner} type={AssetType.Parcel} data={this.state.parcel} title="Description of this parcel" />
      </div>
    )
  }
}
