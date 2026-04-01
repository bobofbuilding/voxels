// Meant to wrap up some common query socping (originally built for the asset library, meant
// to be very generic, but not extensible), its the common things, not an everything
// tool.

export default class Scope {
  public query?: string
  public page = 1
  public sort?: string
  public reverse = false
  public author?: string
  public nonce = false

  constructor(public url: string) {
    // ...
  }

  get limit() {
    return 100
  }

  get offset() {
    return (this.page - 1) * this.limit
  }

  toURL(): URL {
    const url = new URL(window.location.origin + this.url)

    if (this.query) {
      url.searchParams.set('q', this.query)
    }
    if (this.page) {
      url.searchParams.set('page', this.page.toString())
    }
    if (this.sort) {
      url.searchParams.set('sort', this.sort)
    }
    if (this.nonce) {
      url.searchParams.set('nonce', Math.random().toString(36).substring(2, 15))
    }
    if (this.author) {
      url.searchParams.set('author', this.author)
    }

    return url
  }

  toString(): string {
    return this.toURL().toString()
  }

  static parse(path: string, query: URLSearchParams | any): Scope {
    if (query instanceof URLSearchParams) {
      var params = query
    } else {
      var params = new URLSearchParams()

      for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            if (typeof v === 'string') {
              params.append(key, v)
            }
          }
        } else if (typeof value === 'string') {
          params.set(key, value)
        }
      }
    }

    const scope = new Scope(path)

    scope.query = params.get('q') ?? undefined
    scope.page = params.get('page') ? parseInt(params.get('page')!) : 1
    scope.sort = params.get('sort') ?? undefined
    scope.reverse = params.get('reverse') == 'true'
    scope.author = params.get('author') ?? undefined

    return scope
  }
}
