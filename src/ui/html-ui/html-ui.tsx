import { Component } from 'preact'
import { app } from '../../../web/src/state'
import { requestPointerLockIfNoOverlays } from '../../../common/helpers/ui-helpers'

type State = {
  status?: string
}

function setCanvasOpacity(val: string) {
  const c = document.querySelector('canvas')
  if (c) c.style.opacity = val
}

/**
 * This is a Generalized Parent Class of all HTML-UI components that appears onclick such as nft-image ui, collectible-model ui ...
 */
export class HTMLUi<P = any, S extends State = State> extends Component<P, S> {
  constructor() {
    super()
    setCanvasOpacity('0.25')
    window.ui?.disable()
  }

  get isLoggedIn() {
    return app.signedIn
  }

  static close() {
    document.getElementById('renderCanvas')?.focus()
    requestPointerLockIfNoOverlays()
  }

  componentWillUnmount(): void {
    setCanvasOpacity('')
    window.ui?.enable()
  }

  render() {
    return <div></div>
  }
}
