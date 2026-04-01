import { Component, render } from 'preact'
import { unmountComponentAtNode } from 'preact/compat'

const Stats = require('stats.js')

export default class FPSStats extends Component<any, any> {
  static stats: FPSStats
  static currentElement: HTMLElement
  fps: any

  constructor() {
    super()
  }

  static dispose() {
    FPSStats.stats = null!
    FPSStats.currentElement = null!
  }

  static begin() {
    FPSStats.stats?.fps.begin()
  }

  static end() {
    FPSStats.stats?.fps.end()
  }

  componentDidMount() {
    FPSStats.stats = this
    this.fps = new Stats()
    this.fps.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.fps.dom)
    this.fps.dom.style.cssText = 'position:fixed;top:10px;left:50%;cursor:pointer;opacity:0.9;z-index:1000;border-radius: 2px; padding: 2px; background: #111; opacity: 0.5;'
  }

  componentWillUnmount() {
    if (!this.fps) {
      return
    }
    this.fps.end()
    document.body.removeChild(this.fps.dom)
    this.fps = null
  }

  render(): any {
    return null
  }
}

export function toggleFPSStats() {
  if (!!FPSStats.stats) {
    unmountComponentAtNode(FPSStats.currentElement)
    FPSStats.currentElement?.remove()
    FPSStats.dispose()
  } else {
    const div = document.createElement('div')
    document.body.appendChild(div)
    FPSStats.currentElement = div

    render(<FPSStats />, div)
  }
}
