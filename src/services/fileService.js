const fs = require('fs').promises
const path = require('path')
require('dotenv').config()

module.exports.fetchFiles = async (queries) => {
  const results = []
  const TEMP_CATALOG = process.env.TEMP_CATALOG
  const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 1048576

  for (const query of queries) {
    const { directory, pattern } = query

    try {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      )

      const files = await fs.readdir(directory)
      const matchedFiles = files.filter(file => regex.test(file))

      const fileData = await Promise.all(
        matchedFiles.map(async (file) => {
          const filePath = path.join(directory, file)
          const content = await fs.readFile(filePath)

          const fileSize = Buffer.byteLength(content, 'base64')
          const numChunks = Math.ceil(fileSize / CHUNK_SIZE)

          if (numChunks <= 1) {
            const filePath = path.join(TEMP_CATALOG, `${file}`)
            await fs.writeFile(filePath, content)
            return {
              fileName: file,
              content: content.toString('base64')
            }
          } else {
            const firstChunk = content.slice(0, CHUNK_SIZE)
            const firstChunkPath = path.join(TEMP_CATALOG, `${file}_chunk_1`)
            await fs.writeFile(firstChunkPath, firstChunk)

            const chunks = []
            for (let i = 0; i < numChunks; i++) {
              const chunkContent = content.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
              const chunkPath = path.join(TEMP_CATALOG, `${file}_chunk_${i + 1}`)
              await fs.writeFile(chunkPath, chunkContent)
              chunks.push({
                fileName: file,
                chunkId: i + 1,
                numChunks,
                chunkPath
              })
            }

            return {
              fileName: file,
              firstChunkPath,
              chunks
            }
          }
        })
      )

      results.push({ directory, matchedFiles: fileData })
    } catch (err) {
      results.push({ directory, error: err.message })
    }
  }

  return results
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

