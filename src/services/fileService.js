const fs = require('fs').promises
const path = require('path')
require('dotenv').config()

module.exports.fetchFiles = async (queries) => {
  const results = []

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
          const chunkSize = parseInt(process.env.CHUNK_SIZE) || 1048576
          const numChunks = Math.ceil(fileSize / chunkSize)

          if (numChunks <= 1) {
            return {
              fileName: file,
              content: content.toString('base64')
            }
          } else {
            const chunk = content.slice(0, chunkSize)
            return {
              fileName: file,
              chunkId: 1,
              numChunks,
              chunkContent: chunk.toString('base64')
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
  const chunkSize = parseInt(process.env.CHUNK_SIZE) || 1048576
  const tempDirectory = process.env.TEMP_CATALOG

  try {
    const filePath = path.join(tempDirectory, fileName)
    const stats = fs.statSync(filePath)

    const start = (chunkId - 1) * chunkSize
    const end = Math.min(start + chunkSize, stats.size)

    const buffer = Buffer.alloc(end - start)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buffer, 0, buffer.length, start)
    fs.closeSync(fd)

    return { fileName, chunkId, content: buffer.toString('base64') }
  } catch (err) {
    console.error(err)
    return null
  }
}