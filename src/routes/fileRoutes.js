const fileController = require('../controllers/fileController')
const isAuthorizedGuard = require('../guards/isAuthorizedGuard')
const dataExchangeSchema = require('../schemas/dataExchangeSchema')

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

  done()
}

