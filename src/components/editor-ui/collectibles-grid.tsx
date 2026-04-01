import type { CollectiblesData } from '../../../common/helpers/collections-helpers'
import { findMostSimilarsInArray } from '../../../web/src/utils'

interface Props {
  collectibles: CollectiblesData[]
  callback?: (collectible: CollectiblesData) => void
  filter: string
}

export function CollectiblesGrid(props: Props) {
  const onClick = (collectible: CollectiblesData) => {
    props.callback && props.callback(collectible)
  }

  const similarNames = findMostSimilarsInArray(
    props.filter.toLowerCase(),
    props.collectibles.map((c) => c.name.toLowerCase()),
  )

  const collectibles = props.collectibles
    .filter((collectible: CollectiblesData) => !props.filter || similarNames.includes(collectible.name.toLowerCase()))
    .map((collectible: CollectiblesData) => {
      return (
        <a onClick={() => onClick(collectible)}>
          <img src={collectible.gif} width={55} height={55} title={collectible.name} alt={collectible.name} />
        </a>
      )
    })

  return (
    <div>
      <div className="category-models">
        {collectibles && collectibles.length == 0 ? (
          <div>
            No collectibles found, see{' '}
            <a href="/marketplace" target="_blank">
              the marketplace
            </a>
            !
          </div>
        ) : (
          collectibles
        )}
      </div>
    </div>
  )
}
