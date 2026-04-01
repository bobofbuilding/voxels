import { Component } from 'preact'

export default class CollectibleNotFound extends Component<any, any> {
  render() {
    return (
      <section>
        <head>
          <title>Voxels - Collectible Not found</title>
          <meta property="og:title" name="twitter:title" content="Collectible not found."></meta>
        </head>

        <h2>Collectible not found.</h2>
        <a onClick={() => window?.history.back()}>Go back</a>
      </section>
    )
  }
}
