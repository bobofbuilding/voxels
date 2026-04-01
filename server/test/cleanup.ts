import test from 'tape'
import db from '../pg'

// disconnect from pg when done to avoid hanging the test cli
test.onFinish(() => {
  setTimeout(() => {
    db.drain()
  }, 500)
})
