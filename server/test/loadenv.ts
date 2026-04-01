const result = require('dotenv').config({
  path: '.env',
})

export default result
// use .env because I do not want to leak DATABASE URL of follower
