import { ComponentChildren } from 'preact'

export function BrowserSortingOptions(props: { toggleSort: (field: string) => void; children?: ComponentChildren; sort: string; ascending: boolean }) {
  const { toggleSort } = props

  const className = (field: string) => {
    return `${props.sort == field && 'active'} ${props.ascending ? 'ascending' : 'descending'}`
  }

  return (
    <div className="SortingOptions">
      <b>Sort by:</b>
      <a className={className('name')} onClick={() => toggleSort('name')}>
        Name
      </a>
      <a className={className('views')} onClick={() => toggleSort('views')} title="Sort by view count">
        Views
      </a>
      <a className={className('created_at')} onClick={() => toggleSort('created_at')} title="Sort by date created">
        Created at
      </a>
      {props.children}
    </div>
  )
}
