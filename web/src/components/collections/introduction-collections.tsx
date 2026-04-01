import { Component } from 'preact'
import { WearableViewer } from '../../wearable-viewer'
import { createRef } from 'preact/compat'

export default class IntroductionCollections extends Component {
  private viewer?: WearableViewer
  private canvas = createRef()

  componentDidMount() {
    this.viewer = new WearableViewer(this.canvas.current)
    this.viewer.loadHash('e7b3c2cdfb5b153a1105e627298ca99d1486b5a2')
  }

  componentWillUnmount() {
    this.viewer?.dispose()
  }

  render() {
    return (
      <div>
        <h3>About Wearables</h3>

        <p>
          Voxel collectibles are <a href="https://ethereum.org/en/nft/">NFTs</a> that are spawnable in-world. Depending on the type of collection (wearable or furniture), users can wear their NFTs.
        </p>

        <canvas ref={this.canvas} style="border: 1px solid #ccc; width: 320px; height: 320px" />

        <h3>Making your own collection</h3>

        <p>
          Having your collection created and whitelisted in Voxels means you can create your own brand of collectibles based on the blockchain. You can have players/builders wear or place the collectibles of that collection in-world. They
          will also be able to find your collection and collectibles on the Voxels website and Opensea. You'll be able to manage some aspects of your collection directly from Voxels.
        </p>

        <h3>Rules</h3>

        <p>If somehow you fail to uphold these standards, we may suppress your collection.</p>

        <ol>
          <li>
            Obey the <a href="/conduct">Code of conduct</a>.
          </li>
          <li>
            Your wearable must be <a href="https://en.wiktionary.org/wiki/SFW">safe for work</a> and non violent.
          </li>
          <li>
            Your collectible should be a <code>32x32x32</code> <a href="https://ephtracy.github.io/">.vox</a> file, created with magicavoxel or a compatible program.
          </li>
          <li>
            You need to own a Voxels parcel to create a collection. <b>Cool</b> people will publish your collectibles in their collection if you don't have a parcel yet.
          </li>
          <li>Offensive content is banned</li>
          <li>Hateful content is banned</li>
          <li>Realistic guns are banned</li>
          <li>Pornography, willies, balls and fannies are banned</li>
          <li>
            If you're being <b>cool</b> and minting other peopels collectibles, please make sure each of them respect our community guidelines.
          </li>
        </ol>

        <p>These rules are to keep Voxels safe for students and people voxelling at work.</p>
      </div>
    )
  }
}
