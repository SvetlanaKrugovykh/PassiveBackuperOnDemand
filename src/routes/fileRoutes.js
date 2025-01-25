const fileController = require('../controllers/fileController')
const isAuthorizedGuard = require('../guards/isAuthorizedGuard')
const dataExchangeSchema = require('../schemas/dataExchangeSchema')
const dataChunkSchema = require('../schemas/dataChunkSchema')

module.exports = (fastify, _opts, done) => {

  fastify.route({
    method: 'POST',
    url: '/get-files',
    handler: fileController.getFiles,
    preHandler: [
      isAuthorizedGuard
    ],
    schema: dataExchangeSchema
  })

  fastify.route({
    method: 'POST',
    url: '/fetch-сhunk',
    handler: fileController.fetchChunk,
    preHandler: [
      isAuthorizedGuard
    ],
    schema: dataChunkSchema
  })

  done()
}

