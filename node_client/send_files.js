const archiver = require('archiver')
// Archive file to zip, returns path to archive
function zipFile(inputPath) {
  return new Promise((resolve, reject) => {
    const outputZip = inputPath + '.zip'
    const output = fs.createWriteStream(outputZip)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => resolve(outputZip))
    archive.on('error', reject)
    archive.pipe(output)
    archive.file(inputPath, { name: path.basename(inputPath) })
    archive.finalize()
  })
}
const fs = require('fs')
const sendTelegramMessage = require('./send_telegram')
const path = require('path')
const axios = require('axios')
// const cron = require('node-cron')
const crypto = require('crypto')
// Simple file logger
function logToFile(msg) {
  const logDir = path.join(__dirname, '../logs')
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  const logPath = path.join(logDir, 'client.log')
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(logPath, line)
  console.log(line.trim())
}

const configPath = path.join(__dirname, 'client.config.json')

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

function getTelegramConfig() {
  const config = loadConfig()
  return {
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId
  }
}

function getDateStr(offset = 0, format = 'yyyy_mm_dd') {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  // Support different date formats
  return format
    .replace(/yyyy/g, yyyy)
    .replace(/mm/g, mm)
    .replace(/dd/g, dd)
}

function findFilesByPatterns(directory, patterns, dateModes = ['today', 'yesterday'], recursive = false) {
  let files = []
  if (!Array.isArray(patterns)) patterns = [patterns]
  if (!Array.isArray(dateModes)) dateModes = [dateModes]
  function walk(dir) {
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      return []
    }
    let found = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (recursive) {
          found = found.concat(walk(fullPath))
        }
      } else {
        found.push(fullPath)
      }
    }
    return found
  }
  let fileList = []
  if (recursive) {
    fileList = walk(directory)
  } else {
    try {
      fileList = fs.readdirSync(directory).map(f => path.join(directory, f))
    } catch (e) {
      fileList = []
    }
  }
  for (const pattern of patterns) {
    let dateFormat = 'yyyy_mm_dd'
    let patternTemplate = pattern
    const dateMatch = pattern.match(/\{date(?::([^}]+))?}/)
    if (dateMatch) {
      if (dateMatch[1]) dateFormat = dateMatch[1]
      patternTemplate = pattern.replace(/\{date(?::[^}]+)?}/, '{date}')
    }
    for (const mode of dateModes) {
      let offset = 0
      if (mode === 'yesterday') offset = -1
      if (mode === 'today') offset = 0
      const dateStr = getDateStr(offset, dateFormat)
      const mask = patternTemplate.replace('{date}', dateStr)
      const regex = new RegExp('^' + mask.replace(/\./g, '\.').replace(/\*/g, '.*') + '$')
      for (const filePath of fileList) {
        const fileName = path.basename(filePath)
        if (regex.test(fileName)) {
          files.push(filePath)
        }
      }
    }
  }
  return [...new Set(files)]
}

async function sendFileJob(job, telegramConfig) {
  const {
    file,
    serverUrl,
    token,
    senderServerName,
    serviceName,
    chunkSize = 52428800,
    maxRetries = 3
  } = job
  if (!fs.existsSync(file)) {
    logToFile(`File not found: ${file}`)
    return
  }
  logToFile(`Start sending file: ${file}`)
  const stat = fs.statSync(file)
  const fileSize = stat.size
  const numChunks = Math.ceil(fileSize / chunkSize)
  const fileName = path.basename(file)
  // Calculate sha256 for the file using streaming (do not load entire file into memory)
  logToFile(`Calculating sha256 for large file...`)
  const hashStream = crypto.createHash('sha256')
  await new Promise((resolve, reject) => {
    const s = fs.createReadStream(file)
    s.on('data', chunk => hashStream.update(chunk))
    s.on('end', resolve)
    s.on('error', reject)
  })
  const hash = hashStream.digest('hex')
  logToFile(`File ${file} sha256: ${hash}`)
  logToFile(`File size: ${fileSize} bytes, chunks: ${numChunks}`)
  const readStream = fs.createReadStream(file, { highWaterMark: chunkSize })
  let chunkId = 1
  let failed = false
  for await (const chunk of readStream) {
    const b64 = chunk.toString('base64')
    const data = {
      fileName,
      chunkId: Number(chunkId), // ensure integer
      numChunks,
      content: b64,
      senderServerName,
      serviceName,
      sha256: hash
    }
    let sent = false
    let attempt = 0
    while (!sent && attempt < maxRetries) {
      try {
        const resp = await axios.post(`${serverUrl}/upload-chunk`, data, {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json'
          }
        })
        logToFile(`Sent chunk ${chunkId}/${numChunks} for ${fileName}: ${resp.status}`)
        console.log(`Sent chunk ${chunkId}/${numChunks} for ${fileName}`)
        sent = true
      } catch (e) {
        attempt++
        logToFile(`Error sending chunk ${chunkId} for ${fileName} (attempt ${attempt}): ${e.message}`)
        console.error(`Error sending chunk ${chunkId} for ${fileName} (attempt ${attempt}): ${e.message}`)
        if (attempt >= maxRetries) {
          logToFile(`Failed to send chunk ${chunkId} for ${fileName} after ${maxRetries} attempts.`)
          failed = true
          // Send Telegram notification about failure (connection issue)
          if (telegramConfig.botToken && telegramConfig.chatId) {
            await sendTelegramMessage(
              '🚨 <b>File transfer failed</b>!\nClient <b>' + senderServerName + '</b> could not connect to the server for file <b>' + fileName + '</b>. Please check the server status.',
              telegramConfig.botToken,
              telegramConfig.chatId
            )
          }
          return
        }
        await new Promise(res => setTimeout(res, 1000 * attempt)) // Exponential backoff
      }
    }
    chunkId++
  }
  // If all chunks sent and not failed, send success notification
  if (!failed && telegramConfig.botToken && telegramConfig.chatId) {
    await sendTelegramMessage(
      '📦 <b>File transfer complete</b>!\nAll files from client <b>' + senderServerName + '</b> have been successfully delivered to the server.',
      telegramConfig.botToken,
      telegramConfig.chatId
    )
  }
  if (!failed) {
    logToFile(`File ${file} sent successfully!`)
  }
}

async function main() {
  const config = loadConfig()
  const telegramConfig = getTelegramConfig()
  const jobs = config.jobs || config
  for (const job of jobs) {
    // If patterns (or pattern) and directory are specified — search files by masks with dateMode support
    if ((job.patterns || job.pattern) && job.directory) {
      const patterns = job.patterns || job.pattern
      const dateModes = job.dateMode || ['today', 'yesterday']
      const recursive = job.recursive === true
      const files = findFilesByPatterns(job.directory, patterns, dateModes, recursive)
      logToFile(`Found ${files.length} files for job in directory ${job.directory}${recursive ? ' (recursive)' : ''}`)
      for (const file of files) {
        let fileToSend = file
        // zip support
        if (job.zip) {
          fileToSend = await zipFile(file)
        }
        await sendFileJob({ ...job, file: fileToSend }, telegramConfig)
        // optionally, remove zip after send
        if (job.zip) {
          try { fs.unlinkSync(fileToSend) } catch {}
        }
      }
    } else if (job.file) {
      // Standard mode — send specific file
      logToFile(`Sending single file: ${job.file}`)
      await sendFileJob(job, telegramConfig)
    }
  }
}

// Run once at startup
main()
