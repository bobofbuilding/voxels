import { isEqual } from 'lodash'
import { Component } from 'preact'
import { TRAIT_DISPLAY_TYPES, TraitDisplayTypes } from '../../../../common/messages/collectibles'

interface Props {
  customAttributes?: TraitType[]
  onSave?: (customAttributes: TraitType[]) => void
}

interface State {
  customAttributes: TraitType[]
}

export interface TraitType {
  trait_type: string
  value?: number | string
  display_type?: string
  ignore?: boolean
}

export default class CustomCollectionTraits extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      customAttributes: props.customAttributes ?? [],
    }
  }

  get customAttributes() {
    return this.state.customAttributes
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.customAttributes, this.props.customAttributes)) {
      this.setState({ customAttributes: this.props.customAttributes ?? [] })
    }
  }

  setTrait(index: number, value: TraitType) {
    this.setState((prev) => {
      const newAttrib = Array.from(prev.customAttributes)
      newAttrib[index] = value
      return { customAttributes: newAttrib }
    }, this.save.bind(this))
  }

  removeTrait(index: number) {
    const customAttributes = Array.from(this.state.customAttributes)
    customAttributes.splice(index, 1)

    this.setState({ customAttributes }, () => {
      this.save()
    })
  }

  addCustomTrait() {
    const display_type = TraitDisplayTypes.StringTrait
    const trait_type = ''

    const trait = { display_type, trait_type } as TraitType
    this.setState({ customAttributes: this.state.customAttributes.concat([trait]) })
  }

  save() {
    this.props.onSave?.(this.customAttributes)
  }

  render() {
    const traits = this.customAttributes.map((trait, i) => <Trait key={i} trait={trait} index={i} onUpdate={this.setTrait.bind(this)} onRemove={this.removeTrait.bind(this)} />)
    return (
      <div>
        <p>Attributes are extra properties you can give to your collectibles.</p>
        <p>
          <b>They are optional.</b>
        </p>
        <p>
          <a href="https://docs.opensea.io/docs/metadata-standards#section-attributes" target="_blank">
            See what are attributes and what they look like on Opensea{' '}
          </a>
          . You are limited to 3 extra attributes. {this.customAttributes.length < 3 && <button onClick={() => this.addCustomTrait()}>Add a trait</button>}
        </p>
        <div>{traits}</div>
      </div>
    )
  }
}

interface PropsTrait {
  trait: TraitType
  onUpdate?: (index: number, value: TraitType) => void
  onRemove?: (index: number) => void
  index: number
}

type StateTrait = TraitType

export class Trait extends Component<PropsTrait, StateTrait> {
  constructor(props: PropsTrait) {
    super(props)
    this.state = {
      display_type: props.trait.display_type ?? 'string_trait',
      trait_type: props.trait.trait_type || '',
    }
  }

  get showSave() {
    return this.props.trait.display_type !== this.state.display_type || this.props.trait.trait_type !== this.state.trait_type
  }

  componentDidUpdate(prevProps: PropsTrait) {
    if (prevProps.trait.display_type !== this.props.trait.display_type || prevProps.trait.trait_type !== this.props.trait.trait_type) {
      this.setState({ display_type: this.props.trait.display_type, trait_type: this.props.trait.trait_type })
    }
  }

  update(state: Partial<StateTrait>) {
    if (!state) return
    this.setState(state)
  }

  remove() {
    this.props.onRemove?.(this.props.index)
  }

  save() {
    this.props.onUpdate?.(this.props.index, this.state)
  }

  render() {
    const trait_types = TRAIT_DISPLAY_TYPES.map((type) => {
      if (!type.type) return null
      return (
        <option key={type.type} value={type.type}>
          {type.name}
        </option>
      )
    })
    return (
      <div>
        <b>Attribute {this.props.index + 1}</b>
        <div>
          <label>Name </label>
          <input type="text" value={this.state.trait_type} maxLength={30} onInput={(e) => this.update({ trait_type: e.currentTarget['value'] })} />
        </div>
        <div>
          <label>Type </label>
          <select value={this.state.display_type} onInput={(e) => this.update({ display_type: e.currentTarget['value'] })}>
            {trait_types}
          </select>
        </div>
        <button onClick={() => this.remove()}>Remove</button>
        {this.showSave && <button onClick={() => this.save()}>Save</button>}
      </div>
    )
  }
}
