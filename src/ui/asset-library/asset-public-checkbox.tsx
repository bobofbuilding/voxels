import { inputType } from './input-type'
import { useEffect, useState } from 'preact/compat'
import { app } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'
import { JSX } from 'preact'

export function AssetPublicCheckbox(props: inputType) {
  const { asset, onSave } = props
  const [visibility, setVisibility] = useState<boolean>(!!asset.public)
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => {
    setVisibility(!!asset.public!)
  }, [asset.id])

  const save = async () => {
    if (visibility == asset.public) {
      // don't save if category hasn't changed
      return
    }
    setSaving(true)
    const p = await asset.update({ public: visibility })
    if (!!p.success) {
      app.showSnackbar('Visibility saved!', PanelType.Success)
      onSave(asset)
    } else {
      app.showSnackbar(p.message || 'Could not save', PanelType.Danger)
    }
    setSaving(false)
  }

  const onChange: JSX.GenericEventHandler<HTMLInputElement> = (e) => {
    if (saving) {
      return
    }
    setVisibility(e.currentTarget.checked)
    save()
  }

  return (
    <label>
      <input disabled={saving} type="checkbox" checked={visibility} onChange={onChange} />
      The public can use this item
    </label>
  )
}
