// INPUTS----------------------------
import { LibraryAsset } from '../../library-asset'

export interface inputType {
  asset: LibraryAsset
  onSave: (asset: LibraryAsset) => void
}
