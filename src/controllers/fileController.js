module.exports.uploadChunk = async function (request, reply) {
  try {
    let { fileName, chunkId, numChunks, content } = request.body
    if (typeof chunkId === 'string' && /^\d+$/.test(chunkId)) {
      chunkId = parseInt(chunkId, 10)
    }
    if (!fileName || typeof fileName !== 'string' || typeof chunkId !== 'number' || !Number.isInteger(chunkId) || typeof content !== 'string') {
      return reply.status(400).send({ error: 'Invalid input format' })
    }
    const tempDir = process.env.TEMP_CATALOG || 'C:/Temp/chunks/'
    const fs = require('fs')
    const path = require('path')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const chunkPath = path.join(tempDir, `${fileName}_chunk_${chunkId}`)
    const buffer = Buffer.from(content, 'base64')
    fs.writeFileSync(chunkPath, buffer)
    return reply.send({ success: true, message: `Chunk ${chunkId} for ${fileName} uploaded.` })
  } catch (error) {
    reply.status(500).send({ error: 'Error processing upload', details: error.message })
  }
}
const fileService = require('../services/fileService')

module.exports.getFiles = async function (request, reply) {
  try {
    const { queries, senderServerName, serviceName, transferDescription } = request.body
    if (!Array.isArray(queries)) {
      return reply.status(400).send({ error: 'Invalid input format' })
    }

    // Optionally ensure storage path based on provided metadata
    if (process.env.STORAGE_ROOT_DIR && senderServerName && serviceName) {
      const ensured = await fileService.ensureStoragePath(senderServerName, serviceName)
      if (ensured && Number(process.env.DEBUG_LEVEL) > 0) {
        console.log(`Storage path ensured: ${ensured}`)
        if (transferDescription) console.log(`Transfer description: ${transferDescription}`)
      }
    }

    const results = await fileService.fetchFiles(queries)
    return reply.send(results)
  } catch (error) {
    reply.status(500).send({ error: 'Error processing request', details: error.message })
  }
}

module.exports.fetchChunk = async function (request, reply) {
  try {
    let { fileName, chunkId } = request.body
    // Ensure chunkId is integer (schema expects integer)
    if (typeof chunkId === 'string' && /^\d+$/.test(chunkId)) {
      chunkId = parseInt(chunkId, 10)
    }
    if (!fileName || typeof fileName !== 'string' || typeof chunkId !== 'number' || !Number.isInteger(chunkId)) {
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