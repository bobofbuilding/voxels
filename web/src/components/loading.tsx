import { Component } from 'preact'
import { canUseDom } from '../../../common/helpers/utils'

// import Footer from './footer'

interface Props {
  ssrContent?: Record<string, string> // for server-side loaded content: {content name:stringified content}
}

export default class Loading extends Component<Props, any> {
  render() {
    const scriptContent = this.props.ssrContent && Array.from(Object.entries(this.props.ssrContent))[0]
    const key = scriptContent && scriptContent[0]
    const value = scriptContent && scriptContent[1]

    const dataProp: Record<string, any> | undefined = {}
    if (value) {
      dataProp[`data-${key}-id`] = value
    }
    return (
      <section>
        {key && !canUseDom && (
          <script id={`${key}-json`} {...dataProp} type="application/json">
            {value}
          </script>
        )}

        <p>
          <div />
          Loading...
        </p>
      </section>
    )
  }
}
