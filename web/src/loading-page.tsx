import { VNode } from 'preact'
import LoadingIcon from './components/loading-icon'

export default function LoadingPage(props: { admin?: boolean; text?: string; children?: VNode[] }) {
  if (!!props.admin) {
    return (
      <div>
        <head>
          {props.children}
          <meta name="robots" content="noindex"></meta>
          <title>Voxels - Admin</title>
        </head>

        <section>
          <div>
            <LoadingIcon />
          </div>
        </section>
      </div>
    )
  }

  return (
    <section>
      <head>
        <title>Voxels</title>
      </head>

      <div>
        <span>
          <LoadingIcon /> {props.text}
        </span>
      </div>
    </section>
  )
}
