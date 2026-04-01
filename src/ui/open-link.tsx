import { render } from 'preact'
import { unmountComponentAtNode } from 'preact/compat'
import { exitPointerLock, requestPointerLockIfNoOverlays } from '../../common/helpers/ui-helpers'
import { isURL } from '../utils/helpers'

function isExternal(url: string) {
  if (!isURL(url)) {
    return true
  }
  const u = new URL(url)
  return !u.hostname.endsWith('voxels.com') && !u.hostname.endsWith('cryptovoxels.com')
}

export default function (url: string) {
  const div = document.createElement('div')
  div.className = 'open-link pointer-lock-close OverlayWindow'
  document.body.appendChild(div)

  const target = !isExternal(url) ? '_self' : '_blank'
  exitPointerLock()

  const close = () => {
    div && unmountComponentAtNode(div)
    div.remove()
    requestPointerLockIfNoOverlays()
  }

  try {
    var domain = new URL(url).hostname
  } catch (e) {
    domain = 'External Link'
  }

  render(
    <div id="foo">
      <button className="close" onClick={() => close()}>
        &times;
      </button>
      <h3>
        <a href={url} title={url} target={target}>
          {domain}
        </a>
      </h3>
      <br />
      {isExternal(url) && (
        <p>
          <iframe src={url} sandbox="allow-same-origin allow-scripts" referrerpolicy="no-referrer" loading="lazy" width="100%" height="600" style="border: none;"></iframe>
          <br />
          <small>Voxels is not responsible for the information, content or products found on third party websites. </small>
        </p>
      )}
      Link:{' '}
      <a style={{ fontSize: 'small', fontStyle: 'italic' }} href={url} target={target}>
        <small>{url}</small>
      </a>
    </div>,
    div,
  )
}
