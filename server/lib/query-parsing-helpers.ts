type QueryParam = string | qs.ParsedQs | (string | qs.ParsedQs)[] | undefined

export const parseQueryInt = (param: QueryParam, defaultResult = NaN): number => {
  const limit = typeof param === 'string' ? parseInt(param, 10) : defaultResult

  return isNaN(limit) ? defaultResult : limit
}
