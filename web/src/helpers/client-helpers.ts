export function getClientPath(version: string): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const clientJSFileName = `${version}-${process.env.CLIENT_JS_FILE_NAME}.js`
  return isProduction ? `/${clientJSFileName}` : `/proxy/client/${clientJSFileName}`
}
