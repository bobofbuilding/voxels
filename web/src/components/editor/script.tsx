import { throttle } from 'lodash'
import { Component, createRef } from 'preact'
import Feature from '../../../../src/features/feature'
import CodeFlask from '../../../../vendor/codeflask/codeflask'

type ScriptProps = {
  feature: Feature
}

export class Script extends Component<ScriptProps, any> {
  update: () => void
  containerRef = createRef<HTMLDivElement>()
  flask: CodeFlask | null

  constructor(props: ScriptProps) {
    super(props)

    this.state = {
      script: props.feature.script.slice(),
      scriptsRunning: !!this.parcelScript?.connected,
    }

    this.flask = null

    this.update = throttle(
      () => {
        this.props.feature.set({ script: this.state.script })
      },
      500,
      { leading: false, trailing: true },
    )
  }

  get ui() {
    return window.ui
  }

  get main() {
    return window.main
  }

  get textarea() {
    return document.querySelector('.f textarea.script-editor') as HTMLTextAreaElement
  }

  get parcel() {
    return this.props.feature.parcel
  }

  get parcelScript() {
    return this.parcel.parcelScript
  }

  get hasHostedScripts() {
    return !!this.parcelScript && !!this.parcel.hostedScripts
  }

  areScriptsRunning = (bool: boolean) => {
    this.setState({ scriptsRunning: bool })
  }

  componentDidMount() {
    this.flask = new CodeFlask(this.containerRef!.current!, {
      language: 'js',
      lineNumbers: false,
      defaultTheme: true,
      readonly: false,
    })

    this.flask.updateCode(this.state.script)
    this.flask.onUpdate((code) => {
      this.setState({ script: code })
      this.update()
    })

    if (this.parcelScript) {
      this.parcelScript.onScriptStarted.add(this.areScriptsRunning)
    }
  }

  refreshTextarea() {
    this.textarea.value = this.state.script
  }

  componentWillUnmount() {
    if (this.parcelScript) {
      this.parcelScript.onScriptStarted.removeCallback(this.areScriptsRunning)
    }
  }

  render() {
    return (
      <div class="script-editor">
        <label>Script</label>

        <div class="codeflask-container" ref={this.containerRef} />
      </div>
    )
  }
}
