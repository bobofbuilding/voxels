import { JSXInternal } from 'preact/src/jsx'

interface PaginationProps {
  page: number
  path: string
  limit: number
  description: string | null
  queryParams?: URLSearchParams
  total?: number
}

export default function PaginationLinks(props: PaginationProps) {
  const total = Number(props.total)
  if (isNaN(total)) {
    return null
  }

  const pageCount = Math.ceil(total / props.limit)
  if (pageCount <= 1) {
    return <Summary page={props.page} limit={props.limit} total={total} description={props.description} />
  }

  const el: JSXInternal.Element[] = []

  const range = 7
  const perSide = Math.floor(range / 2)

  let startPage = props.page - perSide
  let endPage = props.page + perSide

  if (startPage < 1) {
    endPage += Math.abs(startPage) + 1
    startPage = 1
  }
  if (endPage > pageCount) {
    startPage -= endPage - pageCount
    endPage = pageCount
  }

  startPage = Math.max(1, startPage)
  endPage = Math.min(pageCount, endPage)

  el.push(<a href={`${props.path}?${params(1, props.queryParams)}`}>&laquo;</a>)
  el.push(<Prev page={props.page} path={props.path} search={props.queryParams} />)
  el.push(<span>&nbsp;</span>)
  for (let i = startPage; i <= endPage; i++) {
    el.push(
      <a aria-current={i == props.page ? 'page' : undefined} href={`${props.path}?${params(i, props.queryParams)}`}>
        {i}
      </a>,
    )
  }
  el.push(<span>&nbsp;</span>)
  el.push(<Next page={props.page} pageCount={pageCount} path={props.path} search={props.queryParams} />)
  el.push(<a href={`${props.path}?${params(pageCount, props.queryParams)}`}>&raquo;</a>)

  return (
    <>
      <Summary page={props.page} limit={props.limit} total={total} description={props.description} />
      <ul class="pagination" style={'display:flex; gap:1rem;'}>
        {el}
      </ul>
    </>
  )
}

const params = (p: number, queryParams?: URLSearchParams): string => {
  const u = new URLSearchParams(queryParams)
  u.set('page', p.toString())
  return u.toString()
}

type SummaryProps = {
  page: number
  limit: number
  total: number
  description: string | null
}

function Summary(props: SummaryProps) {
  const start = (props.page - 1) * props.limit + 1
  const ends = Math.min(props.page * props.limit, props.total)
  return (
    <p>
      Displaying <b>{Math.min(start, ends)}</b>-<b>{ends}</b> of <b>{props.total}</b>
      {props.description ? ` ${props.description}` : ''}.
    </p>
  )
}

function Prev({ page, path, search }: { page: number; path: string; search?: URLSearchParams }) {
  return page <= 1 ? <a>&larr; Prev</a> : <a href={`${path}?${params(page - 1, search)}`}>&larr; Prev</a>
}

function Next({ page, pageCount, path, search }: { page: number; pageCount: number; path: string; search?: URLSearchParams }) {
  return page >= pageCount ? <a>Next &rarr;</a> : <a href={`${path}?${params(page + 1, search)}`}>Next &rarr;</a>
}
