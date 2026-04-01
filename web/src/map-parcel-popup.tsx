import { render } from 'preact-render-to-string'
import ParcelHelper from '../../common/helpers/parcel-helper'
import { copyTextToClipboard, encodeCoords } from '../../common/helpers/utils'
import { MapParcelRecord } from '../../common/messages/api-parcels'
import { PanelType } from './components/panel'
import ParcelEvent from './helpers/event'
import { app } from './state'

const copyToClipboard = (playCoords: string | null) => {
  if (!playCoords) return
  copyTextToClipboard(
    playCoords,
    () => {
      app.showSnackbar('Copied!', PanelType.Success)
    },
    () => {
      app.showSnackbar('Try again', PanelType.Warning)
    },
  )
}

export function mapParcelPopup(
  map: L.Map,
  latLng: {
    lat: number
    lng: number
  },
  parcel: MapParcelRecord,
  openSpawnUrl: (url: string) => void,
) {
  const div = document.createElement('div')
  div.className = 'map-teleport-popup'

  const marker = window.L.popup().setLatLng([latLng.lat, latLng.lng])

  const helper = new ParcelHelper(parcel)

  // once loaded, show parcel info with spawn
  div.innerHTML = render(
    <article class="component">
      <strong>
        <a href={`/parcels/${parcel.id}`}>{parcel.name || parcel.address}</a>
      </strong>
      <div>at {parcel.address}</div>
      <div>
        Owned by{' '}
        <a href={`/u/${parcel.owner}`} target="_blank">
          {parcel.owner_name || parcel.owner.substring(0, 10) + '...'}
        </a>
      </div>
      {/* container used for popup on-click of the map.  */}
      <div id="popup-buttonContainer" role="group"></div>
    </article>,
  )

  const buttonContainer = div.querySelector('#popup-buttonContainer')!

  const button = document.createElement('button')
  button.className = 'teleportHere'
  button.textContent = 'Teleport here'
  button.onclick = () => {
    button.textContent = 'Loading..'
    button.disabled = true
    helper.spawnUrl().then(openSpawnUrl)
    map.closePopup(marker)
  }

  buttonContainer.appendChild(button)

  // COPY TELEPORT URL
  const button2 = document.createElement('button')
  button2.className = 'copyCoordinates'
  button2.textContent = 'Copy Coordinates'
  button2.onclick = () => {
    button2.textContent = 'Loading..'
    button2.disabled = true
    helper.spawnUrl().then(copyToClipboard)
    map.closePopup(marker)
  }
  buttonContainer.appendChild(button2)

  marker.setContent(div).openOn(map)
}

export function mapTeleportPopup(map: L.Map, latLng: L.LatLng, openSpawnUrl: (url: string) => void) {
  const div = document.createElement('div')
  div.className = 'map-teleport-popup'

  // show loading
  const coords = {
    position: BABYLON.Vector3.FromArray([latLng.lng * 100, 2.5, latLng.lat * 100]),
    rotation: BABYLON.Vector3.Zero(),
    flying: true,
  }

  const marker = window.L.popup().setLatLng([latLng.lat, latLng.lng])
  const encoded = encodeCoords(coords)
  // once loaded, show parcel info with spawn.
  // add div to contain the popup on click
  div.innerHTML = render(<div id="popup-buttonContainer" role="group"></div>)

  const buttonContainer = div.querySelector('#popup-buttonContainer')!
  // TELEPORT HERE BUTTON
  const teleportHereBtn = document.createElement('button')
  teleportHereBtn.className = 'teleportHere'
  teleportHereBtn.textContent = 'Teleport here'
  teleportHereBtn.onclick = () => {
    openSpawnUrl(`/play?coords=${encoded}`)
    map.closePopup(marker)
  }
  buttonContainer.appendChild(teleportHereBtn)

  // COPY TELEPORT URL
  const copyCoordsLinkBtn = document.createElement('button')
  copyCoordsLinkBtn.className = 'teleportHere'
  copyCoordsLinkBtn.textContent = 'Copy Coordinates'
  copyCoordsLinkBtn.onclick = () => {
    console.log(encoded)
    copyTextToClipboard(
      `${process.env.ASSET_PATH}/play?coords=${encoded}`,
      () => {
        app.showSnackbar('Copied!', PanelType.Success)
      },
      () => {
        app.showSnackbar('Try again', PanelType.Warning)
      },
    )

    map.closePopup(marker)
  }
  buttonContainer.appendChild(copyCoordsLinkBtn)
  marker.setContent(div).openOn(map)
}

export function mapEventMarkerPopup(event: ParcelEvent, openSpawnUrl: (url: string | null) => void): L.Content {
  const div = document.createElement('div')
  div.className = 'map-teleport-popup'

  const isExhibition = event.category === 'exhibition'

  // once loaded, show parcel info with spawn
  div.innerHTML = render(
    <div>
      <h2>
        {isExhibition ? 'Exhibiton now showing ' : 'Event live now '} at {event.parcel_address}
      </h2>

      <br />

      <strong>
        <a href={`/events/${event.id}`}>{event.name}</a>
      </strong>

      <br />

      <div>
        Hosted by{' '}
        <a href={`/u/${event.author}`} target="_blank">
          {event.authorNameOrAddress(10)}
        </a>
      </div>
      <br />
      <div style={{ textAlign: 'center' }}></div>
    </div>,
  )

  const buttonContainer = div.querySelector('#popup-buttonContainer')!

  const button = document.createElement('button')
  button.className = 'teleportHere'
  button.textContent = 'Visit now'
  button.onclick = () => {
    button.textContent = 'Loading...'
    button.disabled = true
    event.getTeleportString().then(openSpawnUrl)
  }

  buttonContainer.appendChild(button)

  // COPY TELEPORT URL
  const button2 = document.createElement('button')
  button2.className = 'copyCoordinates'
  button2.textContent = 'Copy link to event'
  button2.onclick = () => {
    button2.textContent = 'Loading...'
    button2.disabled = true
    event.getTeleportString().then(copyToClipboard)
  }
  buttonContainer.appendChild(button2)

  return div
}
