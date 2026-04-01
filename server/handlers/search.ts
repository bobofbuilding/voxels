import { Request, Response } from 'express'
import db from '../pg'

export async function searchAndReturn(req: Request, res: Response) {
  let { q } = req.query

  if (!q) {
    res.json({ success: true, results: [] })
    return
  }

  q = q.toString()
  q = q.replace(/%/g, '')
  q = q.slice(0, 80)
  q = q.toLowerCase()

  if (q == ' ' || q == '') {
    res.json({ success: true, results: [] })
    return
  }

  q = `%${q}%`

  const limit = 50
  const page = 0

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const query = require(`Server/queries/search.sql`)

  let results = []

  try {
    const queryConfig: any = {
      text: query,
      name: 'search.sql',
      values: [q, limit, page * limit],
    }

    const queryResult = await db.query<any>(queryConfig)
    results = queryResult.rows
  } catch (err: any) {
    res.json({ success: false })
    return
  }

  res.json({ success: true, results })
}
