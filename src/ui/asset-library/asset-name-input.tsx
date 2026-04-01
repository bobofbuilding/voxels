import { inputType } from './input-type'
import { useEffect, useState } from 'preact/compat'
import { app } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'

export function AssetNameInput(props: inputType) {
  const { asset, onSave } = props
  const [name, setName] = useState<string>(asset.name)
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => {
    setName(asset.name!)
  }, [asset.id])

  const save = async () => {
    if (name === asset.name) {
      // don't save if name hasn't changed
      return
    }
    setSaving(true)
    const p = await asset.update({ name })
    if (!!p.success) {
      app.showSnackbar('Name saved!', PanelType.Success)
      onSave(asset)
    } else {
      app.showSnackbar(p.message || 'Could not save', PanelType.Danger)
    }
    setSaving(false)
  }

  const onBlur = () => {
    if (saving) {
      return
    }
    save()
  }

  return <input type="text" name="name" disabled={saving} onBlur={onBlur} value={name} onInput={(e) => setName(e.currentTarget.value)} />
}
