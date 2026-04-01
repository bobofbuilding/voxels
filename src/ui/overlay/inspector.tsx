import Feature from '../../features/feature'
import Group from '../../features/group'
import { useState } from 'preact/hooks'
import { FeatureType } from '../../../common/messages/feature'
import { uniq } from 'lodash'
import { CheckedFeatures, selectCheckedFeatures, selectNearestEditableParcel, setCheckedFeatures, toggleCheckFeature, uncheckFeature } from '../../store'

const dissolveGroup = (group: Group) => () => {
  const ui = window.ui
  if (group.group) {
    // this group is part of a group
    ui?.editFeature(group.group)
  } else {
    // ui?.parcelTabs?.setTabFromFeature('inspector')()
  }
  group.dissolve()
  ui?.featureTool.unHighlight()
}

const allSelected = (features: Feature[] | undefined, checkedFeatures: CheckedFeatures) => {
  return (features?.length || 0) === Object.keys(checkedFeatures).length
}

type FeatureSort = 'type' | 'proximity' | 'id'
type FeatureFilter = FeatureType | 'everything'
type FeatureSearch = string

interface InspectorTabProps {
  group?: Group
}

const InspectorTab = (props: InspectorTabProps) => {
  const checkedFeatures = selectCheckedFeatures()

  const connector = window.connector
  const ui = window.ui

  const [sortBy, setSortBy] = useState<FeatureSort>('proximity') // Sort field
  const [filterBy, setFilterBy] = useState<FeatureFilter>('everything')
  const [searchBy, setSearchBy] = useState<FeatureSearch>('')
  const [sortAscending, setSortAscending] = useState<boolean>(true) // ascending / descending sort
  const [showSearch, setShowSearch] = useState<boolean>(true) // Search Display

  const featuresList = selectNearestEditableParcel()?.featuresList

  const features = props.group ? props.group.children || [] : (featuresList || []).filter((feature: Feature) => !!feature).filter((feature: Feature) => !feature.groupId) // no children- only root features

  let sortedFeatures: Feature[] = features

  if (sortBy == 'proximity') {
    sortedFeatures = features.sort((a: Feature, b: Feature) => {
      if (sortAscending) {
        return BABYLON.Vector3.Distance(a.positionInGrid, connector.controls.camera.position) - BABYLON.Vector3.Distance(b.positionInGrid, connector.controls.camera.position)
      } else {
        return BABYLON.Vector3.Distance(b.positionInGrid, connector.controls.camera.position) - BABYLON.Vector3.Distance(a.positionInGrid, connector.controls.camera.position)
      }
    })
  } else if (sortBy == 'type') {
    sortedFeatures = features.sort((a: Feature, b: Feature) => {
      return (sortAscending ? 1 : -1) * a.type.localeCompare(b.type)
    })
  } else if (sortBy == 'id') {
    sortedFeatures = features.sort((a: Feature, b: Feature) => {
      return (sortAscending ? 1 : -1) * (a.description.id || '').localeCompare(b.description.id || '')
    })
  }

  sortedFeatures = sortedFeatures.filter((feature: Feature) => filterBy === 'everything' || feature.type === filterBy)

  sortedFeatures = sortedFeatures.filter((feature: Feature) => {
    const url = feature.url?.toLowerCase() || ''
    const id = feature.description.id?.toLowerCase() || ''
    const link = feature.description.link?.toLowerCase() || ''
    const featureType = feature.type
    return searchBy == '' || (id + url + link + featureType).includes(searchBy)
  })

  const removeFeaturesFromGroup = () => {
    Object.values(checkedFeatures).forEach((feature) => {
      feature.removeFromGroup()
      uncheckFeature(feature)
    })
  }

  const deleteConfirm = () => {
    const amountFeatures = Object.values(checkedFeatures).reduce((accumulator, feature) => {
      accumulator++

      if (feature.type == 'group') {
        accumulator += (feature as Group).children.length
      }

      return accumulator
    }, 0)
    return amountFeatures >= 2 ? window.confirm(`Delete ${amountFeatures} features?`) : true
  }

  const deleteSelection = () => {
    if (deleteConfirm()) {
      Object.values(checkedFeatures).forEach((feature: Feature) => feature.delete())
      setCheckedFeatures([])
      ui?.featureTool.unHighlight()
    }
  }

  const onSelectAll = async () => {
    if (allSelected(sortedFeatures, checkedFeatures)) {
      setCheckedFeatures([])
    } else {
      setCheckedFeatures(sortedFeatures)
    }
  }

  let featureOptions = features.map((f: Feature) => f.type)
  featureOptions = uniq([...featureOptions]).sort()

  const featureLabel = (feature: string) => {
    feature = feature.charAt(0).toUpperCase() + feature.substr(1).toLowerCase()
    return feature.replace('-', ' ')
  }

  return (
    <section className="ParcelInspectorTab">
      <header>
        <h1>Tree</h1>
      </header>

      <div className="InspectorTabTools">
        <label style={{ width: '112px' }}>
          <i class={sortAscending ? 'fi-caret-down' : 'fi-caret-up'} onClick={() => setSortAscending(!sortAscending)} />
          <select
            value={sortBy}
            style={{ margin: '0 2px' }}
            onChange={(e) => {
              setSortBy(e.currentTarget.value as FeatureSort)
            }}
          >
            <option value="proximity">Proximity</option>
            <option value="id">ID</option>
            <option value="type">Type</option>
          </select>
        </label>
        <label>
          <select value={filterBy} style={{ margin: '0 2px' }} onChange={(e) => setFilterBy(e.currentTarget.value as FeatureFilter)}>
            <option value="everything" default>
              Everything
            </option>
            {featureOptions && featureOptions.map((feature: FeatureType) => <option value={feature}>{featureLabel(feature)}</option>)}
          </select>
        </label>
        <label>
          <i class={showSearch ? 'fi-caret-down' : 'fi-caret-up'} onClick={() => setShowSearch(!showSearch)} />
          <input type="text" placeholder="Feature Search.." style={showSearch ? { display: 'none' } : { display: 'inline-block', marginTop: '12px' }} onChange={(e) => setSearchBy(e.currentTarget.value as string)}></input>
          <span onClick={() => setShowSearch(!showSearch)} style={{ cursor: 'pointer', paddingLeft: '5px' }}>
            Search
          </span>
        </label>
      </div>

      {!!sortedFeatures ? <FeaturesListContainer features={sortedFeatures} group={props.group} /> : <LoadingState />}
      {(props.group || !!features) && <InspectorBottomBar group={props.group} features={sortedFeatures} onSelectAll={onSelectAll} removeFeaturesFromGroup={removeFeaturesFromGroup} deleteSelection={deleteSelection} />}
    </section>
  )
}

const LoadingState = () => {
  return (
    <div className="scrollContainer">
      <p>Loading...</p>
    </div>
  )
}

interface FeaturesListContainerProps {
  features: Feature[]
  group: Group | undefined
}

const FeaturesListContainer = (props: FeaturesListContainerProps) => {
  const checkedFeatures = selectCheckedFeatures()
  const FeaturesListItems = props.features.map((feature) => {
    return <FeaturesListItem feature={feature} selectionMode={Object.values(checkedFeatures).length > 0} checked={!!checkedFeatures[feature.uuid]} group={props.group} />
  })

  if (props.group) {
    return <ul className="features">{FeaturesListItems}</ul>
  } else {
    return (
      <div className="scrollContainer">
        <ul className="features">{FeaturesListItems}</ul>
      </div>
    )
  }
}

interface FeaturesListItemProps {
  feature: Feature
  checked: boolean
  group: Group | undefined
  selectionMode: boolean
}

const FeaturesListItem = (props: FeaturesListItemProps) => {
  const ui = window.ui

  const feature = props.feature

  let img = <img title={feature.type} src={`/icons/${feature.type}.png`} />

  const isImage = feature.type == 'nft-image' || feature.type == 'image'
  if (isImage && feature.url) {
    const url = 'https://cdn.cryptovoxels.com/node/img?mode=color&url=' + encodeURIComponent(feature.url)

    img = <img src={url} />
  }

  return (
    <div key={feature.uuid}>
      <li
        className="feature-container"
        onClick={
          props.selectionMode
            ? () => {
                toggleCheckFeature(feature)
              }
            : () => ui?.editFeature(feature)
        }
        onMouseOver={() => ui?.featureTool?.highlightFeature(feature)}
        onMouseOut={() => {
          props.group && ui?.featureTool?.highlightFeature(props.group)
        }}
      >
        {img}
        <input
          className="feature-checkbox checkbox"
          checked={!!props.checked}
          onInput={() => {
            toggleCheckFeature(feature)
          }}
          onClick={(e) => e.stopPropagation()}
          type="checkbox"
        />
        <div className={`feature-copy-container${props.group ? '-group' : ''}`}>
          <p>
            {feature.description?.id} {feature.toString()!.replace(/^https*.../, '')}
          </p>
          <small>{feature.uuid.slice(0, 16)}...</small>
        </div>
      </li>
    </div>
  )
}

interface InspectorBottomBarProps {
  group: Group | undefined
  features: Feature[]
  onSelectAll: () => any
  removeFeaturesFromGroup: () => any
  deleteSelection: () => any
}

const InspectorBottomBar = (props: InspectorBottomBarProps) => {
  if (!props.features?.length) {
    return null
  }
  const checkedFeatures = selectCheckedFeatures()

  const _allSelected = allSelected(props.features, checkedFeatures)
  const selection = Object.values(checkedFeatures)
  const amountSelected = selection.length
  const someButNotAllSelected = !!amountSelected && !_allSelected
  const selectionContainsASpawnPoint = selection.some((feature: Feature) => feature.description.type === 'spawn-point')

  // Buttons
  const disableGroupButton = !!(selectionContainsASpawnPoint || !amountSelected)
  const showRemoveFromGroupButton = !!props.group && someButNotAllSelected
  const showDeleteButton = props.group ? someButNotAllSelected : !!amountSelected

  const createGroup = (selection: Feature[]) => () => {
    const ui = window.ui
    ui && ui.featureTool.createGroup(selection)
    setCheckedFeatures([])
  }

  return (
    <div className="inspector-bottom-bar">
      <div className={props.group ? 'inspector-bottom-bar-buttons-group' : 'inspector-bottom-bar-buttons'}>
        {showRemoveFromGroupButton && <button onClick={props.removeFeaturesFromGroup}>Ungroup</button>}
        {!!props.group && _allSelected && <button onClick={dissolveGroup(props.group)}>Dissolve Group</button>}

        {!props.group && <button disabled={disableGroupButton} onClick={createGroup(selection)}>{`Create Group`}</button>}

        {showDeleteButton && <button onClick={props.deleteSelection}>{`Delete`}</button>}
      </div>
      <div className="inspector-bottom-bar-checkbox-container">
        Select All
        <input className="checkbox inspector-select-all-checkbox" checked={_allSelected} onInput={props.onSelectAll} type="checkbox" />
      </div>
    </div>
  )
}

export default InspectorTab
