const fileService = require('../services/fileService')

exports.getFiles = async (request, reply) => {
  try {
    const { queries } = request.body
    if (!Array.isArray(queries)) {
      return reply.status(400).send({ error: 'Invalid input format' })
    }

    const results = await fileService.fetchFiles(queries)
    return reply.send(results)
  } catch (error) {
    reply.status(500).send({ error: 'Error processing request', details: error.message })
  }
}
