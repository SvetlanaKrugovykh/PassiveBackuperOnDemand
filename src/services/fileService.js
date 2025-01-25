const fs = require('fs').promises
const path = require('path')

exports.fetchFiles = async (queries) => {
  const results = []
  for (const query of queries) {
    const { directory, pattern } = query

    try {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
      )

      const files = await fs.readdir(directory)
      const matchedFiles = files.filter(file => regex.test(file)) // Сравнение через регулярное выражение
      const fileData = await Promise.all(
        matchedFiles.map(async file => {
          const filePath = path.join(directory, file)
          const content = await fs.readFile(filePath)
          return { fileName: file, content: content.toString('base64') }
        })
      )

      results.push({ directory, matchedFiles: fileData })
    } catch (err) {
      results.push({ directory, error: err.message })
    }
  }
  return results
}
