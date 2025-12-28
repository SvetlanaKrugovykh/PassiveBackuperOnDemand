const limitPromise = import('p-limit').then(mod => mod.default)
const fs = require('fs').promises
const path = require('path')
const { createReadStream, createWriteStream, appendFileSync, existsSync, mkdirSync } = require('fs')
const archiver = require('archiver')
const crypto = require('crypto')
require('dotenv').config()

// Simple file logger
function logToFile(msg) {
  const logDir = path.join(__dirname, '../../logs')
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
  const logPath = path.join(logDir, 'backuper.log')
  const line = `[${new Date().toISOString()}] ${msg}\n`
  appendFileSync(logPath, line)
}

module.exports.ensureStoragePath = async function (senderServerName, serviceName) {
  const SLASH = process.env.SLASH || path.sep
  const ROOT = process.env.STORAGE_ROOT_DIR

  if (!ROOT || !senderServerName || !serviceName) return null

  const normalizedRoot = ROOT.endsWith(SLASH) ? ROOT.slice(0, -SLASH.length) : ROOT
  const storagePath = `${normalizedRoot}${SLASH}${senderServerName}${SLASH}${serviceName}`

  try {
    await fs.mkdir(storagePath, { recursive: true })
    return storagePath
  } catch (err) {
    console.error(`Error ensuring storage path: ${err.message}`)
    return null
  }
}

module.exports.fetchFiles = async (queries) => {
  const results = []
  const TEMP_CATALOG = process.env.TEMP_CATALOG
  const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 20971520

  for (const query of queries) {
    const { directory, pattern, zip } = query
    const isZip = zip === true || zip === 'true'

    try {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
      const matchedFiles = await findFiles(directory, regex)

      const fileData = await Promise.all(matchedFiles.map(async (filePath) => {
        const stats = await fs.stat(filePath)
        const fileSize = stats.size
        console.log(`File ${filePath} size: ${fileSize}`)

        let finalFilePath = filePath
        if (isZip) {
          const zipFilePath = path.join(TEMP_CATALOG, `${path.basename(filePath)}.zip`)
          await zipFile(filePath, zipFilePath)
          finalFilePath = zipFilePath
        }

        const finalStats = await fs.stat(finalFilePath)
        const finalFileSize = finalStats.size
        const numChunks = Math.ceil(finalFileSize / CHUNK_SIZE)

        if (finalFileSize <= CHUNK_SIZE) {
          const content = await fs.readFile(finalFilePath)
          // Calculate sha256
          const hash = crypto.createHash('sha256').update(content).digest('hex')
          logToFile(`File ${finalFilePath} sha256: ${hash}`)
          return {
            fileName: path.basename(finalFilePath),
            content: content.toString('base64'),
            sha256: hash
          }
        } else {
          const chunks = []
          for (let i = 0; i < numChunks; i++) {
            const chunkPath = path.join(TEMP_CATALOG, `${path.basename(finalFilePath)}_chunk_${i + 1}`)
            const readStream = createReadStream(finalFilePath, {
              start: i * CHUNK_SIZE,
              end: Math.min((i + 1) * CHUNK_SIZE - 1, finalFileSize - 1)
            })
            const writeStream = createWriteStream(chunkPath)
            await new Promise((resolve, reject) => {
              readStream.pipe(writeStream).on('finish', resolve).on('error', reject)
            })
            chunks.push({
              fileName: path.basename(finalFilePath),
              chunkId: i + 1,
              numChunks,
              chunkPath
            })
          }
          // After splitting, calculate sha256 and log
          const fileBuffer = await fs.readFile(finalFilePath)
          const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
          logToFile(`File ${finalFilePath} sha256: ${hash}`)
          return { fileName: path.basename(finalFilePath), chunks, sha256: hash }
        }
      // Utility to remove all chunk files after successful assembly
      async function removeChunks(fileName, numChunks, tempCatalog) {
        for (let i = 1; i <= numChunks; i++) {
          const chunkPath = path.join(tempCatalog, `${fileName}_chunk_${i}`)
          try {
            await fs.unlink(chunkPath)
            logToFile(`Deleted chunk: ${chunkPath}`)
          } catch (e) {
            logToFile(`Failed to delete chunk: ${chunkPath} (${e.message})`)
          }
        }
      }
      }))

      results.push({ directory, matchedFiles: fileData })
    } catch (error) {
      results.push({ directory, error: error.message })
    }
  }

  return results
}

async function zipFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.file(inputPath, { name: path.basename(inputPath) })
    archive.finalize()
  })
}

module.exports.fetchChunk = async (fileName, chunkId) => {
  const TEMP_CATALOG = process.env.TEMP_CATALOG
  const filePath = path.join(TEMP_CATALOG, `${fileName}_chunk_${chunkId}`)

  try {
    await fs.access(filePath)
    const content = await fs.readFile(filePath)
    return { fileName, chunkId, content: content.toString('base64') }
  } catch (err) {
    console.error(`Error fetching chunk: ${err.message}`)
    return null
  }
}


module.exports.fetchChunkWithRetry = async function (fileName, chunkId, retries) {
  try {
    const chunkData = await module.exports.fetchChunk(fileName, chunkId)
    return chunkData
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying fetchChunk for ${fileName} chunk ${chunkId}, attempts left: ${retries}`)
      return fetchChunkWithRetry(fileName, chunkId, retries - 1)
    } else {
      console.error(`Failed to fetch chunk ${chunkId} for file ${fileName} after multiple attempts`)
      return null
    }
  }
}

module.exports.confirmChunk = async function (fileName, chunkId) {
  const TEMP_CATALOG = process.env.TEMP_CATALOG
  try {
    const chunkPath = path.join(TEMP_CATALOG, `${fileName}_chunk_${chunkId}`)
    await fs.access(chunkPath)
    await fs.unlink(chunkPath)
    return { fileName, chunkId, content: 'delete confirmed' }
  } catch (error) {
    console.error(`Error confirming chunk: ${error.message}`)
    return false
  }
}

module.exports.confirmFileDeletion = async function (fileName) {
  const TEMP_CATALOG = process.env.TEMP_CATALOG
  try {
    const filePath = path.join(TEMP_CATALOG, fileName)
    await fs.access(filePath)
    await fs.unlink(filePath)
    return { fileName, content: 'delete confirmed' }
  } catch (error) {
    console.error(`Error confirming file deletion: ${error.message}`)
    return false
  }
}

async function findFiles(dir, regex) {
  let results = []
  const list = await fs.readdir(dir, { withFileTypes: true })
  for (const file of list) {
    const filePath = path.join(dir, file.name)
    if (file.isDirectory()) {
      results = results.concat(await findFiles(filePath, regex))
    } else if (regex.test(file.name)) {
      results.push(filePath)
    }
  }
  return results
}
