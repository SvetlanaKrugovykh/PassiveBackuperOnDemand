const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const fs = require('fs')
const { getSecretKey } = require('../guards/getCredentials')

module.exports.createAccessToken = async function (payload) {
  if (process.env.ACCEPT_CREATING_ACCESS_TOKENS === 'true') {
    const expDays = process.env.TOKER_EXPIRE_IN_DAYS || 1
    const expiresIn = expDays * 24 * 3600
    const secretKey = getSecretKey()
    return jwt.sign(payload, secretKey, { expiresIn })
  } else {
    throw new Error('Access token creation is disabled')
  }
}

module.exports.checkAccessToken = async function (token) {
  try {
    const secretKey = getSecretKey()
    return jwt.verify(token, secretKey)
  } catch (err) {
    return null
  }
}

