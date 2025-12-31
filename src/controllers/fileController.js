// Rotate backup directories after all files in a job are uploaded
module.exports.rotateBackupDirsForJob = async function (request, reply) {
  try {
    const { senderServerName, serviceName, rotationCount = 2 } = request.body;
    if (!senderServerName || !serviceName) {
      return reply.status(400).send({ success: false, message: 'Missing params' });
    }
    const storageRoot = process.env.STORAGE_ROOT_DIR || 'D:/PassiveStorage/';
    const baseDir = path.join(storageRoot, senderServerName, serviceName);
    rotateBackupDirs(baseDir, rotationCount);
    reply.send({ success: true });
  } catch (e) {
    reply.status(500).send({ success: false, message: e.message });
  }
}
// Check if all chunks for a file are present (true/false)
module.exports.assembleStatus = async function (request, reply) {
  try {
    const { fileName, numChunks, senderServerName, serviceName } = request.body
    if (!fileName || !numChunks || !senderServerName || !serviceName) {
      return reply.status(400).send({ ok: false, error: 'Missing params' })
    }
    const tempDir = process.env.TEMP_CATALOG || 'C:/Temp/chunks/'
    let allExist = true
    for (let i = 1; i <= numChunks; i++) {
      const chunkPath = require('path').join(tempDir, `${fileName}_chunk_${i}`)
      if (!require('fs').existsSync(chunkPath)) {
        allExist = false
        break
      }
    }
    reply.send({ ok: allExist })
  } catch (e) {
    reply.status(500).send({ ok: false, error: e.message })
  }
}
// Utility: try to assemble file from chunks if all received
const fs = require('fs')
const path = require('path')
// Directory rotation: grandfather-father-son backup scheme
function rotateBackupDirs(baseDir, rotationCount) {
  // rotationCount: 2 (father-son), 3 (grandfather-father-son), ...
  for (let i = rotationCount - 1; i >= 0; i--) {
    const dir = path.join(baseDir, i.toString())
    if (fs.existsSync(dir)) {
      if (i === rotationCount - 1) {
        // Oldest backup — remove
        fs.rmSync(dir, { recursive: true, force: true })
      } else {
        // Shift other backups up
        const nextDir = path.join(baseDir, (i + 1).toString())
        fs.renameSync(dir, nextDir)
      }
    }
  }
  // After rotation, directory '0' is ready for new upload
}

async function tryAssembleFile(fileName, numChunks, senderServerName, serviceName, rotationCount = 2) {
  const tempDir = process.env.TEMP_CATALOG || 'C:/Temp/chunks/'
  const storageRoot = process.env.STORAGE_ROOT_DIR || 'D:/PassiveStorage/'
  if (!senderServerName || !serviceName) return
  const baseDir = path.join(storageRoot, senderServerName, serviceName)
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
  // Do NOT rotate here! Rotation should be done after all files are uploaded for the job.
  const outDir = path.join(baseDir, '0')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, fileName)
  for (let i = 1; i <= numChunks; i++) {
    const chunkPath = path.join(tempDir, `${fileName}_chunk_${i}`)
    if (!fs.existsSync(chunkPath)) return // Not all chunks yet
  }
  // All chunks exist, assemble
  try {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath)
    for (let i = 1; i <= numChunks; i++) {
      const chunkPath = path.join(tempDir, `${fileName}_chunk_${i}`)
      const data = fs.readFileSync(chunkPath)
      fs.appendFileSync(outPath, data)
      fs.unlinkSync(chunkPath)
    }
    // Check final file size
    const expectedSize = numChunks * (parseInt(process.env.CHUNK_SIZE) || 52428800)
    const actualSize = fs.statSync(outPath).size
    if (Number(process.env.DEBUG_LEVEL) > 0) {
      console.log(`[Assemble] File: ${outPath}, expected <= ${expectedSize}, actual: ${actualSize}`)
    }
    // If last chunk is smaller, allow actualSize < expectedSize
    if (actualSize > expectedSize || actualSize === 0) {
      console.error('[Assemble] ERROR: Assembled file size mismatch!')
      if (process.env.DEBUG_SOURCE_FILE && process.env.DEBUG_SOURCE_FILE.startsWith('true')) {
        // Prepend '!' to the file for debug analysis
        try {
          const origData = fs.readFileSync(outPath)
          const fd = fs.openSync(outPath, 'w')
          fs.writeSync(fd, Buffer.from('!'))
          fs.writeSync(fd, origData, 0, origData.length, 1)
          fs.closeSync(fd)
          console.log(`[Assemble] DEBUG_SOURCE_FILE: prepended '!' to file ${outPath}`)
        } catch (e) {
          console.error(`[Assemble] Failed to prepend '!' to file: ${e.message}`)
        }
      } else {
        try { fs.unlinkSync(outPath) } catch {}
      }
    }
  } catch (err) {
    console.error('Error assembling file:', err)
    if (process.env.DEBUG_SOURCE_FILE && process.env.DEBUG_SOURCE_FILE.startsWith('tru')) {
      // Do not delete file, but try to prepend '!'
      try {
        if (fs.existsSync(outPath)) {
          const origData = fs.readFileSync(outPath)
          const fd = fs.openSync(outPath, 'w')
          fs.writeSync(fd, Buffer.from('!'))
          fs.writeSync(fd, origData, 0, origData.length, 1)
          fs.closeSync(fd)
          console.log(`[Assemble] DEBUG_SOURCE_FILE: prepended '!' to file ${outPath}`)
        }
      } catch (e) {
        console.error(`[Assemble] Failed to prepend '!' to file: ${e.message}`)
      }
    } else {
      try { fs.unlinkSync(outPath) } catch {}
    }
  }
}

// Call this after all files in a job are uploaded to rotate backup directories
// ...existing code...

module.exports.uploadChunk = async function (request, reply) {
  try {
    let { fileName, chunkId, numChunks, content, senderServerName, serviceName, rotationCount } = request.body
    if (typeof chunkId === 'string' && /^\d+$/.test(chunkId)) {
      chunkId = parseInt(chunkId, 10)
    }
    if (!fileName || typeof fileName !== 'string' || typeof chunkId !== 'number' || !Number.isInteger(chunkId) || typeof content !== 'string' || typeof numChunks !== 'number') {
      return reply.status(400).send({ error: 'Invalid input format' })
    }
    const tempDir = process.env.TEMP_CATALOG || 'C:/Temp/chunks/'
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    const chunkPath = path.join(tempDir, `${fileName}_chunk_${chunkId}`)
    const buffer = Buffer.from(content, 'base64')
    fs.writeFileSync(chunkPath, buffer)
    // Try to assemble file if all chunks received
    try {
      await tryAssembleFile(fileName, numChunks, senderServerName, serviceName, rotationCount || 2)
      // Rotation is now only triggered via /rotate-backup-dirs endpoint after all files in a job
    } catch {}
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