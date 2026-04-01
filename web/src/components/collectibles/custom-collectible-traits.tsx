import { isEqual } from 'lodash'
import { Component } from 'preact'
import { JSXInternal } from 'preact/src/jsx'
import { TRAIT_DISPLAY_TYPES, TraitDisplayTypes } from '../../../../common/messages/collectibles'
import { app } from '../../state'
import { TraitType } from '../collections/custom-collection-traits'
import { PanelType } from '../panel'
import TargetedMouseEvent = JSXInternal.TargetedMouseEvent

interface Props {
  collectionAttributesNames: TraitType[]
  customAttributes?: TraitType[]
  collectible_id?: string
  onSave?: (shouldCachebust: boolean) => void
  overrideSave?: (state: { customAttributes: TraitType[] }) => void
}

interface State {
  collectionAttributesNames?: TraitType[]
  customAttributes: TraitType[]
  saved: boolean
  loading: boolean
}

export default class CustomCollectibleAttributes extends Component<Props, State> {
  constructor(props: Props) {
    super()
    this.state = {
      loading: false,
      saved: false,
      customAttributes: props.customAttributes ?? [],
      collectionAttributesNames: props.collectionAttributesNames || [],
    }
  }

  get collectionAttributesNames() {
    // Contains the rules of attributes (names and types)
    return (this.state.collectionAttributesNames || []) as TraitType[]
  }

  get collectibleAttributes() {
    // Contains the actual custom attributes for that specific collectible
    return (this.state.customAttributes || []) as TraitType[]
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.customAttributes, this.props.customAttributes) || !isEqual(prevProps.collectionAttributesNames, this.props.collectionAttributesNames)) {
      this.setState({ customAttributes: this.props.customAttributes, collectionAttributesNames: this.props.collectionAttributesNames })
    }
  }

  async saveAttributes(e: TargetedMouseEvent<HTMLButtonElement>) {
    e.preventDefault()

    this.setState({ saved: false, loading: true })

    if (this.props.overrideSave) {
      // We override the save and call the callback instead of saving to DB
      // Used in upload-wearable.tsx
      this.props.overrideSave({ customAttributes: this.state.customAttributes })
      this.setState({ saved: true, loading: false })
      return
    }

    if (!confirm('Are you sure you want to save these attributes? This change is irreversible.')) {
      return
    }

    const body = { custom_attributes: this.state.customAttributes }

    const url = `${process.env.API}/collectibles/w/${this.props.collectible_id}/update`

    fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          app.showSnackbar('✅ ' + this.props.collectible_id + ` attributes have changed.`, PanelType.Success)
          this.props.onSave?.(true)
          this.setState({ saved: true })
        } else {
          app.showSnackbar(r.message || `Could not change attributes`, PanelType.Danger)
        }
        this.setState({ loading: false })
      })
  }

  /**
   * Set the state for that attribute (trait=attribute) within the array
   * @param index index of the attribute in the custom_attribute array
   * @param value TraitType. (an object)
   */
  setTrait(index: number, value: TraitType) {
    const customAttributes = Array.from(this.state.customAttributes)
    customAttributes[index] = value

    this.setState({ customAttributes })
  }

  render() {
    if (this.collectionAttributesNames?.length == 0) {
      return <div></div>
    }
    const traits = this.collectionAttributesNames.map((attributeSpecification, i) => {
      const trait = this.collectibleAttributes.find((attribute) => attributeSpecification.trait_type == attribute.trait_type)
      return <Trait trait={trait || attributeSpecification} index={i} onUpdate={this.setTrait.bind(this)} />
    })
    return (
      <div>
        <div>{traits}</div>
        <button disabled={this.state.loading} onClick={this.saveAttributes.bind(this)}>
          {this.state.loading ? `Saving...` : 'Save attributes'}
        </button>
        {this.state.saved && <i></i>}
      </div>
    )
  }
}

interface PropsTrait {
  trait: TraitType
  onUpdate?: (index: number, value: TraitType) => void
  index: number
}

export class Trait extends Component<PropsTrait, TraitType> {
  constructor(props: PropsTrait) {
    super()
    this.state = {
      display_type: props.trait?.display_type ?? TraitDisplayTypes.Number,
      value: props.trait?.value ?? (props.trait?.display_type == TraitDisplayTypes.StringTrait ? '' : '0'),
      trait_type: props.trait?.trait_type || '',
      ignore: !!props.trait?.ignore,
    }
  }

  get displayTypeName() {
    return TRAIT_DISPLAY_TYPES.find((a) => a.type == this.state.display_type)?.name
  }

  setStateAsync(state: Partial<TraitType>): Promise<void> {
    return new Promise((resolve) => {
      this.setState(state, resolve)
    })
  }

  componentDidUpdate(prevProps: PropsTrait) {
    if (
      prevProps.trait.display_type !== this.props.trait.display_type ||
      prevProps.trait.value !== this.props.trait.value ||
      prevProps.trait.trait_type !== this.props.trait.trait_type ||
      prevProps.trait.ignore !== this.props.trait.ignore
    ) {
      this.setStateAsync({
        ignore: this.props.trait.ignore,
        display_type: this.props.trait.display_type,
        value: this.props.trait.value,
        trait_type: this.props.trait.trait_type,
      })
    }
  }

  async update(dict: Partial<TraitType>) {
    if (!dict) {
      return
    }
    await this.setStateAsync(dict)
    this.props.onUpdate?.(this.props.index, this.state)
  }

  render() {
    return (
      <div>
        <b>{this.displayTypeName} attribute</b>
        <div>
          <label>Name : {this.state.trait_type}</label>
        </div>
        {this.state.display_type !== TraitDisplayTypes.StringTrait ? (
          <div>
            <label>Value </label>
            <input type="number" size={12} max={100} min={0} value={parseInt(this.state.value?.toString() ?? '0')} step={1} title="Value of trait" onInput={(e) => this.update({ value: e.currentTarget['value'] })} />
          </div>
        ) : (
          <div>
            <label>Value </label>
            <input type="text" size={12} maxLength={50} value={this.state.value?.toString()} title="Value of trait." onInput={(e) => this.update({ value: e.currentTarget['value'] })} />
          </div>
        )}
        <div>
          <label>
            <input title="Ignore this attribute" type="checkbox" name="ignoreAttribute" onChange={(e) => this.update({ ignore: e.currentTarget['checked'] })} checked={this.state.ignore} />
            Ignore
          </label>
        </div>
      </div>
    )
  }
}
