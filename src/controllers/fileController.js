const fileService = require('../services/fileService')

module.exports.getFiles = async function (request, reply) {
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

module.exports.fetchChunk = async function (request, reply) {
  try {
    const { fileName, chunkId } = request.body

    if (!fileName || typeof chunkId !== 'number') {
      return reply.status(400).send({ error: 'Invalid input format' })
    }

    const chunkData = await fileService.fetchChunkWithRetry(fileName, chunkId)

    if (!chunkData) {
      return reply.status(404).send({ error: 'Chunk not found' })
    }

    return reply.send(chunkData)
  } catch (error) {
    reply.status(500).send({ error: 'Error processing request', details: error.message })
  }
}

module.exports.confirmChunk = async function (req, reply) {
  const { fileName, chunkId } = req.body

  try {
    const result = await fileService.confirmChunk(fileName, chunkId)

    if (result) {
      reply.send(result)
    } else {
      reply.code(404).send({ success: false, message: 'Chunk not found.' })
    }
  } catch (error) {
    reply.code(500).send({ success: false, message: 'Internal server error.' })
  }
}

module.exports.confirmFileDeletion = async function (req, reply) {
  const { fileName } = req.body

  try {
    const result = await fileService.confirmFileDeletion(fileName)

    if (result) {
      reply.send(result)
    } else {
      reply.code(404).send({ success: false, message: 'File not found.' })
    }
  } catch (error) {
    reply.code(500).send({ success: false, message: 'Internal server error.' })
  }
}