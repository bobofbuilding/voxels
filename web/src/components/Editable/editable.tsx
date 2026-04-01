import { Component } from 'preact'
import { AssetType, saveAsset } from '../../helpers/save-helper'
import { app } from '../../state'
import { PanelType } from '../panel'

export { AssetType }

export interface Props {
  /**
   * value: the string value of the Editable
   */
  value: string | null
  /**
   * The object to be passed (parcel, space,avatar,costume)
   */
  data: any
  /**
   * A classname for styling
   */
  className?: string
  /**
   * Type of Editable, 'parcels', 'spaces','costumes','avatars'
   */
  type?: AssetType
  /**
   * isOwner of asset?
   */
  isowner?: boolean
  /**
   * onClick function (for costumes for example)
   */
  onclick?: (data: unknown) => void
  /**
   * if active or not (For spaces, shows the little >>)
   */
  active?: boolean
  /**
   * title: tooltip on hover
   */
  title?: string
  /**
   * path: Path of the editable (Necessary for Spaces)
   */
  path?: string
  /**
   * onSave: Callback function called On Save.
   */
  onSave?: () => void
  /**
   * onFail: Callback function called On Fail.
   */
  onFail?: () => void
  /**
   * validationRule: A function called that acts as validation validator
   */
  validationRule?: (s: string) => boolean
}

interface EditableState {
  current?: string
  prevValue?: string
  isEditing: boolean
  value?: string
  previousValue?: string
}

export default class Editable extends Component<Props, EditableState> {
  type: AssetType

  constructor(props: Props) {
    super(props)
    this.type = props.type ?? AssetType.Parcel
    this.state = {
      value: props.value ?? undefined,
      isEditing: false,
      previousValue: props.value ?? undefined,
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.data.id == this.props.data.id && prevProps.value === this.props.value) {
      return
    }
    this.setState({
      value: this.props.value ?? undefined,
      isEditing: false,
      previousValue: this.props.value ?? undefined,
    })
  }

  generateContent() {
    throw new Error('Abstract method called')
  }

  save() {
    // This whole class is fucked and needs to be nuked from orbit
    this.setState({ isEditing: false })
    const body = this.generateContent()

    saveAsset(this.type, this.props.data.id, body).then((r) => {
      if (r.success) {
        app.showSnackbar('Changes saved', PanelType.Success)
        this.props.onSave?.()
      } else {
        app.showSnackbar('Error', PanelType.Danger)
        this.props.onFail?.()
      }
    })
  }

  showIcons() {
    return (
      this.props.isowner && (
        <EditableIcons
          isEditing={this.state.isEditing}
          onEditBegin={() => this.setState({ isEditing: true, previousValue: this.state.value })}
          onEditCancel={() => this.setState({ isEditing: false, value: this.state.previousValue })}
          onEditComplete={() => this.save()}
        />
      )
    )
  }

  getElementType() {
    return <div></div>
  }

  getInputType() {
    return <div></div>
  }

  isEnterKey(event: KeyboardEvent) {
    event.key === 'Enter' && this.setState({ isEditing: false }, this.save)
  }

  render() {
    return <div></div>
  }
}

type EditableIconProps = {
  isEditing: boolean
  onEditBegin(): void
  onEditCancel(): void
  onEditComplete(): void
  buttonText?: string
}

export function EditableIcons({ isEditing, onEditComplete, onEditCancel, onEditBegin, buttonText }: EditableIconProps) {
  const stopProp = (cb: () => void) => {
    return (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation()
      e.preventDefault()
      cb()
    }
  }

  return isEditing ? (
    <span>
      <button title="Save" onClick={stopProp(onEditComplete)}>
        Save
      </button>{' '}
      <button title="Cancel" onClick={stopProp(onEditCancel)}>
        Cancel
      </button>
    </span>
  ) : (
    <span>
      <button onClick={stopProp(onEditBegin)}>{buttonText ?? 'Edit'}</button>
    </span>
  )
}
