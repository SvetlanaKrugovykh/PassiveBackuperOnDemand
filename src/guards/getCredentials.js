const crypto = require('crypto')
const fs = require('fs')

let cachedSecretKey = null

function getSecretKey() {
  if (cachedSecretKey) {
    return cachedSecretKey
  }

  const serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))
  cachedSecretKey = crypto.createHash('sha256').update(serviceAccount.private_key).digest('hex')

  return cachedSecretKey
}

module.exports = { getSecretKey }
