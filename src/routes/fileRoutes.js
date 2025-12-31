const fileController = require('../controllers/fileController')
const isAuthorizedGuard = require('../guards/isAuthorizedGuard')
const dataExchangeSchema = require('../schemas/dataExchangeSchema')
const dataChunkSchema = require('../schemas/dataChunkSchema')
const dataUploadChunkSchema = require('../schemas/dataUploadChunkSchema')

module.exports = (fastify, _opts, done) => {
  fastify.route({
    method: 'POST',
    url: '/assemble-status',
    handler: fileController.assembleStatus,
    preHandler: [isAuthorizedGuard]
  })
  
  fastify.route({
		method: "POST",
		url: "/rotate-backup-dirs",
		handler: fileController.rotateBackupDirsForJob,
		preHandler: [isAuthorizedGuard],
	})

  fastify.route({
    method: 'POST',
    url: '/upload-chunk',
    handler: fileController.uploadChunk,
    preHandler: [isAuthorizedGuard],
    schema: dataUploadChunkSchema
  })

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
    url: '/fetch-chunk',
    handler: fileController.fetchChunk,
    // preHandler: [
    //   isAuthorizedGuard
    // ],
    // schema: dataChunkSchema
  })

  fastify.route({
    method: 'POST',
    url: '/confirm-chunk',
    handler: fileController.confirmChunk,
    preHandler: [isAuthorizedGuard],
    schema: dataChunkSchema
  })

  fastify.route({
    method: 'POST',
    url: '/confirm-file',
    handler: fileController.confirmFileDeletion,
    preHandler: [isAuthorizedGuard],
    schema: {
      body: {
        type: 'object',
        properties: {
          fileName: { type: 'string' }
        }
      }
    }
  })


  done()
}

