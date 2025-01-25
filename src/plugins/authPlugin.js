const fp = require('fastify-plugin')
const ipRangeCheck = require('ip-range-check')
const authService = require('../services/authService')
require('dotenv').config()

const allowedIPAddresses = process.env.API_ALLOWED_IPS.split(',')
const allowedSubnets = process.env.API_ALLOWED_SUBNETS.split(',')

const restrictIPMiddleware = (req, reply, done) => {
  const clientIP = req.ip
  if (!allowedIPAddresses.includes(clientIP) && !ipRangeCheck(clientIP, allowedSubnets)) {
    console.log(`${new Date()}: Forbidden IP: ${clientIP}`)
    reply.code(403).send('Forbidden')
  } else {
    console.log(`${new Date()}: Allowed IP: ${clientIP}`)
    done()
  }
}

async function authPlugin(fastify, _ = {}) {
  fastify.decorateRequest('auth', null)
  fastify.addHook('onRequest', restrictIPMiddleware)
  fastify.addHook('onRequest', async (request, _) => {
    const { authorization } = request.headers
    request.auth = {
      token: null,
      clientId: null
    }
    if (authorization) {
      try {
        request.auth = {
          token: authorization,
        }
      } catch (e) {
        console.log(e)
      }
      const decodedToken = await authService.checkAccessToken(authorization)
      if (decodedToken) {
        console.log('decodedToken:', decodedToken)
      }
    }
  })
}

module.exports = fp(authPlugin)
