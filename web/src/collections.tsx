import { useEffect, useState } from 'preact/hooks'

import Head from './components/head'
import { useListControls } from './components/list-controls'
import { Spinner } from './spinner'
import { fetchOptions } from './utils'
import { Collection } from '../../common/helpers/collections-helpers'

const LIMIT = 100

export default function ListCollections({ path }: { path?: string }) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [page] = useState(0)

  const [controls, controlsEl] = useListControls()

  async function doFetch() {
    setLoading(true)
    let url = `/api/collections?page=${page}&limit=${LIMIT}`
    if (controls.query) url += '&q=' + controls.query
    if (controls.sort) url += '&sort=' + controls.sort

    const r = await fetch(url, fetchOptions())
    const data = await r.json()
    setCollections(data.collections || [])
    setLoading(false)
  }

  useEffect(() => {
    doFetch()
  }, [controls.sort, page])
  useEffect(() => {
    if (controls.submitCount > 0) doFetch()
  }, [controls.submitCount])

  const rows = collections.map((c) => (
    <tr key={c.id}>
      <td>
        <a href={`/collections/${c.id}`}>{c.name}</a>
        <br />
        <small>{c.description}&nbsp;</small>
      </td>
      <td>{c.total_wearables}</td>
    </tr>
  ))

  return (
    <section class="columns">
      <Head title="Collections" url="/collections" description="Asset and wearable collections made by users" />
      <article>
        {controlsEl}

        <table>
          <thead>
            <tr>
              <th scope="col" style="width:70%">
                Name
              </th>
              <th scope="col" style="width:10%">
                Collectibles
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2}>
                  <Spinner />
                </td>
              </tr>
            ) : collections.length > 0 ? (
              rows
            ) : (
              'No collections found.'
            )}
          </tbody>
        </table>
      </article>

      <aside>
        <a href="/collections/new">New collection</a>
      </aside>
    </section>
  )
}
