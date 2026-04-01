////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Types for /api/library messages

import * as t from 'io-ts'

/**
 * /api/library/add
 */
export const ApiLibraryAdd = t.type(
  {
    locations: t.any,
  },
  'ApiLibraryAdd',
)
export type ApiLibraryAdd = t.TypeOf<typeof ApiLibraryAdd>
