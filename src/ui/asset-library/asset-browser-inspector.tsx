import { useEffect, useRef, useState } from 'preact/compat'
import { LibraryAsset } from '../../library-asset'
import { app } from '../../../web/src/state'
import { AssetNameInput } from './asset-name-input'
import Panel, { PanelType } from '../../../web/src/components/panel'
import { CollectibleDescriptionInput } from './collectible-description-input'
import { AssetCategoryInput } from './asset-category-input'
import { format } from 'timeago.js'
import { AssetPublicCheckbox } from './asset-public-checkbox'
import ReportButton from '../../../web/src/components/report-button'

import { FeatureTemplate } from '../../features/_metadata'
import { requestPointerLock } from '../../../common/helpers/ui-helpers'

interface Props {
  asset: LibraryAsset | null
  onUpdate: (asset: LibraryAsset) => void // Function called when we've set the content inside the library asset. (cache the content)
  onCloseInspector: (asset: LibraryAsset | null) => void // Called on close of the inspector (set asset to null generally)
  onRemove: (asset: LibraryAsset) => void // Called when item is removed.
  currentScript?: string // A script (Only used in script-editor tsx)
}

export function AssetBrowserInspector(props: Props) {
  const { asset, onCloseInspector, onRemove, onUpdate, currentScript } = props

  // the toggle of whether to view the script or not.
  const [viewScript, toggleViewScript] = useState<boolean>(false)
  const [libraryAsset, setLibraryAsset] = useState<LibraryAsset | null>(props.asset ? new LibraryAsset(props.asset) : null)
  // A state handler for when we're removing an asset
  const [beingRemoved, setBeingRemoved] = useState<boolean>(false)
  // Reference to let us control the scroll of the scrollContainer
  const scrollContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (props.asset) {
      setLibraryAsset(new LibraryAsset(props.asset))
    }
  }, [props.asset])

  if (!libraryAsset || !asset) {
    // Hide the inspector.
    // Set toggles and states to false.
    toggleViewScript(false)
    setBeingRemoved(false)
    return null
  }

  const isUserAuthor = libraryAsset.author.toLowerCase() === app.state.wallet?.toLowerCase()
  const isModerator = !!app.state.moderator
  const isFeatureOrGroup = libraryAsset.type !== 'script'

  const isScriptAndScriptEditor = !!currentScript && !isFeatureOrGroup

  const isScriptDangerous = libraryAsset.has_unsafe_script

  const spawn = (template: FeatureTemplate) => {
    const ui = window.ui!

    ui.featureTool.setModeAdd(template)
    ui.setTool(ui.featureTool)
    requestPointerLock()
  }

  const insertAsset = async () => {
    const template = libraryAsset.content![0]
    delete template.position
    delete template.rotation

    if (!template.scale) {
      template.scale = [4, 4, 4]
    }

    if (libraryAsset.type !== 'script') {
      spawn(template)
    }

    // if (isScriptAndScriptEditor) {
    //   // We're in the script Editor, instead of attempting to generate a feature
    //   // we overwrite the script in the editor
    //   overWriteScript()
    //   return
    // }
    // onGenerate(libraryAsset)
    // libraryAsset.getContentAndGenerateCopy()
  }
  const removeAsset = async () => {
    if (!confirm('Are you sure you want to remove this asset?')) return
    setBeingRemoved(true)
    const p = await libraryAsset.remove()
    setBeingRemoved(false)
    if (p.success) {
      props.onCloseInspector(null)
      onRemove && onRemove(asset)
    }
  }

  // const copyToClipBoard = () => {
  //   if (asset.type !== 'script') {
  //     return
  //   }
  //   libraryAsset.getContentAndGenerateCopy()
  // }

  /*
   * Return the script of the asset ( all the scripts as one string if multiple features)
   */
  const getAssetScript = () => {
    if (!libraryAsset.content) {
      return null
    }
    if (isFeatureOrGroup) {
      let script = ''
      libraryAsset.content.forEach((a, index) => {
        if (a.script) {
          script += `// -- feature ${a.id || a.type + '-' + index} \n`
          script += a.script + ' \n'
        }
      })
      return script
    } else {
      // script asset only has one item inside content
      return libraryAsset.content[0]
    }
  }

  return (
    <div className="asset-browser-inspector">
      <header>
        <a style={'cursor:pointer;'} onClick={() => onCloseInspector(null)}>
          {'<<<'} Back
        </a>
        <h3>{isUserAuthor ? <AssetNameInput asset={libraryAsset} onSave={onUpdate} /> : libraryAsset.name}</h3>
      </header>
      <div ref={scrollContainer} className="">
        <div className="img">
          <img src={libraryAsset.image_url || '...'} />
        </div>

        <div className="MainActionsButtons">
          {(isFeatureOrGroup || isScriptAndScriptEditor) && (
            <button onClick={insertAsset} title={`Insert the ${libraryAsset.type} asset`}>
              Add to parcel
            </button>
          )}
        </div>
        {isFeatureOrGroup && libraryAsset.has_script && (
          <Panel type={isScriptDangerous ? PanelType.Warning : PanelType.Info}>{isScriptDangerous ? 'This asset has a potentially unsafe script. Make sure to review the script first' : 'This asset is scripted'}</Panel>
        )}

        {!viewScript && (
          <div className="assetbrowser-info">
            <dl>
              <dt>Description</dt>
              <dd>{isUserAuthor ? <CollectibleDescriptionInput asset={libraryAsset} onSave={onUpdate} /> : libraryAsset.description}</dd>

              <dt>Author</dt>
              <dd>{libraryAsset.author_name || libraryAsset.author}</dd>

              <dt>Category</dt>
              <dd>{isUserAuthor ? <AssetCategoryInput asset={libraryAsset} onSave={onUpdate} /> : libraryAsset.category}</dd>

              <dt>Asset Type</dt>
              <dd>{libraryAsset.type}</dd>

              <dt>Uploaded</dt>
              <dd>{format(libraryAsset.created_at)}</dd>

              <dt>Views</dt>
              <dd>{libraryAsset.views}</dd>

              {isUserAuthor && <dt>Public</dt>}
              {isUserAuthor && (
                <dd>
                  <AssetPublicCheckbox asset={libraryAsset} onSave={onUpdate} />
                </dd>
              )}
              <dt>Actions</dt>
              <dd className="user-actions">
                {(isUserAuthor || isModerator) && (
                  <button className="-red" onClick={!beingRemoved ? removeAsset : undefined} title="Remove asset from library">
                    {beingRemoved ? 'Removing' : 'Remove'}
                  </button>
                )}
                <ReportButton type="library-asset" item={props.asset!}>
                  <option value="Asset contains NSFW content">Asset contains NSFW content</option>
                  <option value="Asset contains Violent content">Asset contains Violent content</option>
                  <option value="Asset has plagiarised content">Asset has plagiarised content</option>
                  <option value="Asset violates the rules in other ways">Asset violates the rules in other ways</option>
                </ReportButton>
              </dd>
              <dt>Item id</dt>
              <dd style={{ userSelect: 'text' }}>
                <small>{libraryAsset.id}</small>
              </dd>
            </dl>
          </div>
        )}
        {libraryAsset.content && viewScript && (
          <div>
            <label>Script Preview:</label>
            <textarea cols={30} rows={20} value={getAssetScript()} readOnly={true} />
          </div>
        )}
        <br />
        <br />
      </div>
    </div>
  )
}
