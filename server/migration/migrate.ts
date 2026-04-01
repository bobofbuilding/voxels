import db from '../pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const migrationSql = readFileSync(join(__dirname, '../migrations.sql'))

db.query('embedded/migration', migrationSql.toString())
  .then((result) => {
    console.log('Migrations ran successfully')
  })
  .catch((err) => {
    console.error(err)
  })
  .finally(() => {
    process.exit()
  })
