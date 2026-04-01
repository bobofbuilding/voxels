import { useState } from 'preact/hooks'
import { AssetType, saveAsset } from '../../helpers/save-helper'
import { app } from '../../state'
import Panel, { PanelType } from '../panel'

export default function SlugEditor({ space }: { space: any }) {
  const [slug, setSlug] = useState<string>(space.slug || space.space_id || space.id)
  const [error, setError] = useState<string | null>(null)

  const isUrl = (s: any) => {
    const regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
    return regexp.test(s)
  }

  const saveSlug = async () => {
    setError(null)
    if (!slug) {
      app.showSnackbar('❌ No slug to save.', PanelType.Danger)
      return
    }
    if (!isUrl(`https://www.voxels.com/s/${slug}`)) {
      app.showSnackbar('❌ Slug is not valid', PanelType.Danger)
      return
    }

    const r = await saveAsset(AssetType.Space, space.id, { slug })
    if (!r.success) {
      app.showSnackbar('❌ Something went wrong...', PanelType.Danger)
      if (r.message) {
        setError(r.message)
      }
    } else {
      app.showSnackbar('✔️ Slug saved!', PanelType.Success)
    }
  }
  return (
    <div>
      <h4>Slug</h4>
      <p>A slug is a short user-friendly url to make sharing easier!</p>
      <div>
        <input type="text" name="slug" placeholder={'my-space'} value={slug} onInput={(e) => setSlug(e.currentTarget.value)} />
        <button onClick={() => saveSlug()} title="Save slug">
          ✓
        </button>
        <br />
        <small>
          <a href={`https://www.voxels.com/s/${slug}/play`}>voxels.com/s/{slug}/play</a>
        </small>
        {!!error && (
          <Panel type="danger">
            <div>{error}</div>
          </Panel>
        )}
      </div>
    </div>
  )
}
