const jsesc = require('jsesc')

/* Render a json script block for including data on server side rendered page */
export default function JsonData(props: { id: string; dataId?: string | number; data: any }) {
  const scriptContent = jsesc(props.data, { json: true, isScriptContext: true })
  return <script type="text/json" data-id={props.dataId} id={props.id} dangerouslySetInnerHTML={{ __html: scriptContent }} />
}
