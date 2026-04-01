import { Component } from 'preact'

interface Props {
  items: Array<any>
  callback?: Function
}

export class PublicVoxModelsByCategory extends Component<Props, any> {
  handler: any

  constructor(props: any) {
    super()

    this.state = {
      items: props.items || [],
      category: null,
    }
  }

  get items() {
    return !!this.state.items && this.state.items
  }

  onClick(url: any) {
    this.props.callback && this.props.callback(url)
  }

  render() {
    const voxModels = this.items.map((x: any) => {
      return (
        <a onClick={() => this.onClick(x.vox)}>
          <img src={x.image} width={20} height={20} title={x.name} />
        </a>
      )
    })

    return <div className="category-models">{voxModels}</div>
  }
}

interface libraryProps {
  category: any
  callback?: Function
}

export default class PublicVoxelLibrary extends Component<libraryProps, any> {
  constructor(props: any) {
    super()

    this.state = {
      category: props.category || null,
      collapsed: true,
    }
  }

  get categoryObject() {
    return !!this.state.category && this.state.category
  }

  onClick(url: any) {
    this.props.callback && this.props.callback(url)
  }

  render() {
    return (
      <div>
        <div className="category-name" onClick={() => this.setState({ collapsed: !this.state.collapsed })}>
          <h5>
            {this.state.collapsed ? '+ ' : '- '}
            {this.categoryObject.category}
          </h5>
        </div>
        <div className={`collapsible ${this.state.collapsed ? 'collapsed' : ''}`}>
          <PublicVoxModelsByCategory items={this.categoryObject.items} callback={this.props.callback} />
        </div>
      </div>
    )
  }
}
