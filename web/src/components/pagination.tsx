// <Pagination url='avatars' page={this.state.page} perPage={avatarsPerPage} total={this.state.avatarCount} callback?={Function}/>
type PaginationProps = {
  url?: string
  page?: number
  perPage?: number
  total: number
  callback?: Function
}

export default function Pagination(props: PaginationProps) {
  if (!props.total) {
    return null!
  }

  const scrollBackToTop = () => {
    if (!document || document?.scrollingElement!.scrollTop < 200) {
      return null!
    }
    document.body.scrollTop = 0 // For Safari
    document.documentElement.scrollTop = 0 // For Chrome, Firefox, IE and Opera
  }

  const redirect = (page: number) => {
    if (props.callback && typeof props.callback == 'function') {
      props.callback(page)
      scrollBackToTop()
      return
    }
    window.location.href = `/${props.url}?page=${page}`
  }

  const page = props.page
  const pageCount = Math.ceil(props.total / props.perPage!)

  const pagesCount = []

  for (let i = Math.max(1, page! - 4); i < Math.min(pageCount, page! + 4); i++) {
    pagesCount.push(i)
  }

  const pages = pagesCount.map((p) => {
    return (
      <a
        class={p === page && ('active' as any)}
        onClick={() => {
          redirect(p)
        }}
      >
        {p}
      </a>
    )
  })

  return (
    <div class="Pagination">
      {page! > 1 && (
        <a
          onClick={() => {
            redirect(page! - 1)
          }}
        >
          Previous
        </a>
      )}

      {page! > 9 && <span>...</span>}

      {pages}

      {page! < pageCount - 9 && <span>...</span>}

      {page! < pageCount && (
        <a
          onClick={() => {
            redirect(page! + 1)
          }}
        >
          Next
        </a>
      )}
    </div>
  )
}
