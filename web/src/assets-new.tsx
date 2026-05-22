import { Login } from './auth/login'
import UploadButton from './components/upload-button'
import { app } from './state'

export default function AssetsNew({ path }: { path?: string }) {
  if (!app.signedIn) return <Login reason="upload an asset" />
  return (
    <section>
      <hgroup>
        <h1>Upload Asset</h1>
        <p>Drop .vox files here. Two or more files also open a new collection with wearables.</p>
      </hgroup>

      <article>
        <UploadButton />
      </article>
    </section>
  )
}
