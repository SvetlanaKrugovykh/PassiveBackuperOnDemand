const HttpError = require('http-errors')
const jwt = require('jsonwebtoken')
const { getSecretKey } = require('./getCredentials')

module.exports = function (request, _reply, done) {
  const secretKey = getSecretKey()
  const data = jwt.verify(request.auth.token, secretKey)
  if (!data.clientId) {
    throw new HttpError.Unauthorized('Authorization required')
  }

  done()
}
