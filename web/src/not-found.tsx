import { VNode } from 'preact'

export default function NotFound(props: { path?: string; admin?: boolean; text?: string; children?: VNode[] }) {
  if (!!props.admin) {
    return (
      <div>
        <head>
          {props.children}
          <meta name="robots" content="noindex"></meta>
          <title>Voxels - Admin</title>
        </head>

        <section>
          <h1>Not Found!</h1>
        </section>
      </div>
    )
  }

  return (
    <section>
      <head>
        <title>Voxels</title>
      </head>

      <hgroup>
        <h1>Not Found! - 404</h1>
        <p>The page you are looking for could not be found.</p>
        <p>
          <a href="/">Go back to the homepage</a>
        </p>
      </hgroup>
    </section>
  )
}
