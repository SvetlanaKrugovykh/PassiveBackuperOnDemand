const fs = require('fs').promises
const path = require('path')
const { createReadStream, createWriteStream } = require('fs')
const archiver = require('archiver')
require('dotenv').config()

module.exports.fetchFiles = async (queries) => {
  const results = []
  const TEMP_CATALOG = process.env.TEMP_CATALOG
  const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 20971520
  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2 GiB

  for (const query of queries) {
    const { directory, pattern, zip } = query
    const isZip = zip === true || zip === 'true'

    try {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      )

      const matchedFiles = await findFiles(directory, regex)

      const fileData = await Promise.all(
        matchedFiles.map(async (filePath) => {
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

          if (finalFileSize <= MAX_FILE_SIZE) {
            const content = await fs.readFile(finalFilePath)
            if (numChunks <= 1) {
              const tempFilePath = path.join(TEMP_CATALOG, path.basename(finalFilePath))
              await fs.writeFile(tempFilePath, content)
              return {
                fileName: path.basename(finalFilePath),
                content: content.toString('base64')
              }
            } else {
              const chunks = await Promise.all(
                Array.from({ length: numChunks }, async (_, i) => {
                  const chunkContent = content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                  const chunkPath = path.join(TEMP_CATALOG, `${path.basename(finalFilePath)}_chunk_${i + 1}`)
                  await fs.writeFile(chunkPath, chunkContent)
                  return {
                    fileName: path.basename(finalFilePath),
                    chunkId: i + 1,
                    numChunks,
                    chunkPath
                  }
                })
              )

              return {
                fileName: path.basename(finalFilePath),
                chunks
              }
            }
          } else {
            const chunks = await Promise.all(
              Array.from({ length: numChunks }, async (_, i) => {
                const chunkPath = path.join(TEMP_CATALOG, `${path.basename(finalFilePath)}_chunk_${i + 1}`)
                const readStream = createReadStream(finalFilePath, {
                  start: i * CHUNK_SIZE,
                  end: (i + 1) * CHUNK_SIZE - 1
                })
                const writeStream = createWriteStream(chunkPath)
                await new Promise((resolve, reject) => {
                  readStream.pipe(writeStream)
                    .on('finish', resolve)
                    .on('error', reject)
                })
                return {
                  fileName: path.basename(finalFilePath),
                  chunkId: i + 1,
                  numChunks,
                  chunkPath
                }
              })
            )

            return {
              fileName: path.basename(finalFilePath),
              chunks
            }
          }
        })
      )

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
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)
    archive.file(inputPath, { name: path.basename(inputPath) })
    archive.finalize()
  })
}


module.exports.fetchChunk = async (fileName, chunkId) => {
  const TEMP_CATALOG = process.env.TEMP_CATALOG

  try {
    const filePath = path.join(TEMP_CATALOG, `${fileName}_chunk_${chunkId}`)

    const content = await fs.readFile(filePath)

    return {
      fileName,
      chunkId,
      content: content.toString('base64')
    }
  } catch (err) {
    console.error(err)
    return null
  }
}

module.exports.confirmChunk = async function (fileName, chunkId) {
  const TEMP_CATALOG = process.env.TEMP_CATALOG

  try {
    const chunkPath = path.join(TEMP_CATALOG, `${fileName}_chunk_${chunkId}`)
    await fs.access(chunkPath)
    await fs.unlink(chunkPath)

    return {
      fileName,
      chunkId,
      content: 'delete confirmed'
    }
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

    return {
      fileName,
      content: 'delete confirmed'
    }
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