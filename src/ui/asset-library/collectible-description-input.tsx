import { LibraryAsset } from '../../library-asset'
import { useEffect, useState } from 'preact/compat'
import { app } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'

export function CollectibleDescriptionInput(props: { asset: LibraryAsset; onSave: (asset: LibraryAsset) => void }) {
  const { asset, onSave } = props
  const [description, setDescription] = useState<string>(asset.description!)
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => {
    setDescription(asset.description!)
  }, [asset.id])

  const save = async () => {
    if (description == asset.description) {
      // don't save if description hasn't changed
      return
    }
    setSaving(true)
    const p = await asset.update({ description })
    if (!!p.success) {
      app.showSnackbar('Description saved!', PanelType.Success)
      onSave(asset)
    } else {
      app.showSnackbar(p.message || 'Could not save description', PanelType.Danger)
    }
    setSaving(false)
  }

  const onBlur = () => {
    if (saving) {
      return
    }
    save()
  }

  return <textarea value={description} rows={5} disabled={saving} onBlur={onBlur} maxLength={250} onInput={(e) => setDescription(e.currentTarget.value)} />
}
