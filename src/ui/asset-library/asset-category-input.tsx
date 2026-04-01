import { FeatureAssetCategory, isAssetCategory, LibraryAsset, ScriptAssetCategory } from '../../library-asset'
import { useEffect, useState } from 'preact/compat'
import { app } from '../../../web/src/state'
import { PanelType } from '../../../web/src/components/panel'
import { JSX } from 'preact'

export function AssetCategoryInput(props: { asset: LibraryAsset; onSave: (asset: LibraryAsset) => void }) {
  const { asset, onSave } = props
  const [category, setCategory] = useState<FeatureAssetCategory | ScriptAssetCategory>(asset.category!)
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => {
    setCategory(asset.category!)
  }, [asset.id])

  const save = async () => {
    if (category == asset.category) {
      // don't save if category hasn't changed
      return
    }
    setSaving(true)
    const p = await asset.update({ category })
    if (!!p.success) {
      app.showSnackbar('Category saved!', PanelType.Success)
      onSave(asset)
    } else {
      app.showSnackbar(p.message || 'Could not save', PanelType.Danger)
    }
    setSaving(false)
  }

  const onChange = (e: JSX.TargetedEvent<HTMLSelectElement>) => {
    if (saving) {
      return
    }
    if (isAssetCategory(e.currentTarget.value)) {
      setCategory(e.currentTarget.value)
    } else {
      throw `Bad asset category ${e.currentTarget.value}`
    }
    save()
  }

  const categories = (asset.type == 'script' ? Object.entries(ScriptAssetCategory) : Object.entries(FeatureAssetCategory)).map(([value, category]) => {
    return <option value={category}>{value}</option>
  })

  return (
    <select disabled={saving} value={category} onChange={onChange}>
      {categories}
    </select>
  )
}
