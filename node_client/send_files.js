const archiver = require('archiver')
const os = require('os')

// Safely copy a file (even if locked), creating a snapshot copy
async function safelyCopyLiveFile(sourcePath, destDir = null) {
  const tempDir = destDir || path.join(os.tmpdir(), 'backup_staging')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  const fileName = path.basename(sourcePath)
  const destPath = path.join(tempDir, fileName)
  logToFile(`Creating safe copy of ${sourcePath} to ${destPath}...`)
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath, {
      highWaterMark: 64 * 1024 * 1024,
      flags: 'r'
    })
    const writeStream = fs.createWriteStream(destPath, {
      highWaterMark: 64 * 1024 * 1024
    })
    let copiedBytes = 0
    readStream.on('data', (chunk) => {
      copiedBytes += chunk.length
    })
    readStream.on('error', (err) => {
      writeStream.destroy()
      try { fs.unlinkSync(destPath) } catch {}
      reject(new Error(`Failed to read source file: ${err.message}`))
    })
    writeStream.on('error', (err) => {
      readStream.destroy()
      try { fs.unlinkSync(destPath) } catch {}
      reject(new Error(`Failed to write copy: ${err.message}`))
    })
    writeStream.on('finish', () => {
      logToFile(`Safe copy created: ${destPath} (${copiedBytes} bytes)`)
      resolve(destPath)
    })
    readStream.pipe(writeStream)
  })
}

// Delete temporary staging copy
function cleanupStagingCopy(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      logToFile(`Staging copy deleted: ${filePath}`)
    }
  } catch (err) {
    logToFile(`Failed to delete staging copy ${filePath}: ${err.message}`)
  }
}

// Archive file or folders to zip, returns path to archive
function zipFile(inputPath) {
  return new Promise((resolve, reject) => {
    const outputZip = inputPath + '.zip'
    const output = fs.createWriteStream(outputZip)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => resolve(outputZip))
    archive.on('error', reject)
    archive.pipe(output)
    if (fs.lstatSync(inputPath).isDirectory()) {
      archive.directory(inputPath, path.basename(inputPath))
    } else {
      archive.file(inputPath, { name: path.basename(inputPath) })
    }
    archive.finalize()
  })
}

// Archive multiple folders/files with exclusions and custom output dir
async function zipMultipleWithExclude({ include, exclude = [], format = 'zip', zip_catalog }) {
  const archiveName = `backup_${Date.now()}.${format}`
  const outDir = zip_catalog && typeof zip_catalog === 'string' ? zip_catalog : require('os').tmpdir()
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outputZip = path.join(outDir, archiveName)
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZip)
    const archive = archiver(format, { zlib: { level: 9 } })
    output.on('close', () => resolve(outputZip))
    archive.on('error', reject)
    archive.pipe(output)
    const shouldExclude = (filePath) => exclude.some(ex => filePath.startsWith(path.normalize(ex)))
    for (const inc of include) {
      const stat = fs.lstatSync(inc)
      if (stat.isDirectory()) {
        archive.directory(inc, path.basename(inc), (entry) => {
          const fullPath = path.join(inc, entry.name)
          return shouldExclude(fullPath) ? false : entry
        })
      } else {
        if (!shouldExclude(inc)) archive.file(inc, { name: path.basename(inc) })
      }
    }
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

async function sendFileJob(job, telegramConfig, serverUnavailableRef) {
  const originalFile = job.file
  let fileToSend = originalFile
  let isTemporaryCopy = false

  try {
    // If preCopyFile is enabled, create a staging copy first
    if (job.preCopyFile === true) {
      logToFile(`Pre-copying live file: ${originalFile}`)
      const stagingDir = job.stagingDirectory || path.join(os.tmpdir(), 'backup_staging')
      fileToSend = await safelyCopyLiveFile(originalFile, stagingDir)
      isTemporaryCopy = true
      logToFile(`Using staging copy for transfer: ${fileToSend}`)
    }

    const {
      serverUrl,
      senderServerName,
      serviceName,
      chunkSize = 52428800,
      maxRetries = 3,
      delayBetweenChunksMs = 0
    } = job
    // Use job.token if present, otherwise use config.token
    const config = loadConfig()
    const token = job.token || config.token
    if (!fs.existsSync(fileToSend)) {
      throw new Error(`File not found: ${fileToSend}`)
    }
    logToFile(`Start sending file: ${fileToSend}`)
    const stat = fs.statSync(fileToSend)
    const fileSize = stat.size
    const numChunks = Math.ceil(fileSize / chunkSize)
    const fileName = path.basename(originalFile)
    // Calculate sha256 for the file using streaming (do not load entire file into memory)
    logToFile(`Calculating sha256 for large file...`)
    const hashStream = crypto.createHash('sha256')
    await new Promise((resolve, reject) => {
      const s = fs.createReadStream(fileToSend)
      s.on('data', chunk => hashStream.update(chunk))
      s.on('end', resolve)
      s.on('error', reject)
    })
    const hash = hashStream.digest('hex')
    logToFile(`File ${fileToSend} sha256: ${hash}`)
    logToFile(`File size: ${fileSize} bytes, chunks: ${numChunks}`)
    const readStream = fs.createReadStream(fileToSend, { highWaterMark: chunkSize })
    let chunkId = 1
    let failed = false
    for await (const chunk of readStream) {
      if (serverUnavailableRef && serverUnavailableRef.value) {
        logToFile(`Server already marked as unavailable, skipping file: ${fileName}`)
        failed = true
        break
      }
      const b64 = chunk.toString('base64')
      const data = {
        fileName,
        chunkId: Number(chunkId),
        numChunks,
        content: b64,
        senderServerName,
        serviceName,
        sha256: hash
      }
      if (delayBetweenChunksMs && delayBetweenChunksMs > 0) {
        await new Promise(res => setTimeout(res, delayBetweenChunksMs))
      }
      let sent = false
      let attempt = 0
      while (!sent && attempt < maxRetries) {
        try {
          const resp = await axios.post(`${serverUrl}/upload-chunk`, data, {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json'
            },
            timeout: 300000
          })
          logToFile(`Sent chunk ${chunkId}/${numChunks} for ${fileName}: ${resp.status}`)
          console.log(`Sent chunk ${chunkId}/${numChunks} for ${fileName}`)
          sent = true
          chunkId++
        } catch (e) {
          attempt++
          logToFile(`Error sending chunk ${chunkId} for ${fileName} (attempt ${attempt}): ${e.message}`)
          console.error(`Error sending chunk ${chunkId} for ${fileName} (attempt ${attempt}): ${e.message}`)
          if (attempt >= maxRetries) {
            logToFile(`Failed to send chunk ${chunkId} for ${fileName} after ${maxRetries} attempts.`)
            failed = true
            if (serverUnavailableRef) {
              serverUnavailableRef.value = true
            }
            if (telegramConfig.botToken && telegramConfig.chatId && (!serverUnavailableRef || !serverUnavailableRef.value)) {
              await sendTelegramMessage(
                '🚨 <b>File transfer failed</b>!\nClient <b>' + senderServerName + '</b> could not connect to the server for file <b>' + fileName + '</b>. Please check the server status.',
                telegramConfig.botToken,
                telegramConfig.chatId
              )
            }
            return
          }
          await new Promise(res => setTimeout(res, 1000 * attempt))
        }
      }
    }
    if (!failed && (!serverUnavailableRef || !serverUnavailableRef.value)) {
      // Wait for server to confirm all chunks received
      let assembled = false
      for (let attempt = 1; attempt <= 10; attempt++) {
        try {
          const resp = await axios.post(`${serverUrl}/assemble-status`, {
            fileName,
            numChunks,
            senderServerName,
            serviceName
          }, {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          })
          if (resp.data && resp.data.ok) {
            assembled = true
            break
          }
        } catch (e) {
          // ignore
        }
        await new Promise(res => setTimeout(res, 2000))
      }
      if (assembled) {
        logToFile(`File ${fileName} sent successfully and confirmed!`)
      } else {
        logToFile(`File ${fileName} sent, but server confirmation pending.`)
      }
    }
  } finally {
    // Always cleanup staging copy after transfer (success or failure)
    if (isTemporaryCopy && fileToSend !== originalFile) {
      cleanupStagingCopy(fileToSend)
    }
  }
}

async function main() {
  let config = loadConfig()
  let jobs = config.jobs || config
  // Support running a single job via environment variable (for send_files_cron.js)
  if (process.env.JOB_OVERRIDE) {
    try {
      jobs = [JSON.parse(process.env.JOB_OVERRIDE)]
    } catch {}
  }
  const telegramConfig = getTelegramConfig()
  const delayBetweenFilesMs = (config.delayBetweenFilesMs !== undefined) ? config.delayBetweenFilesMs : 0;
  for (const job of jobs) {
    let jobFailed = false
    let files = []
    let filesTransferred = 0
    let filesNotTransferred = 0
    let serverUnavailableRef = { value: false }
    let consecutiveServerFails = 0
    const maxConsecutiveFails = 3 // after 3 consecutive fails, server is considered unavailable
    // Check runEveryNDays logic
    if (job.runEveryNDays && Number.isInteger(job.runEveryNDays) && job.runEveryNDays > 1) {
      const now = new Date()
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
      if (dayOfYear % job.runEveryNDays !== 0) {
        logToFile(`Skipping job for ${job.senderServerName || job.serviceName || job.file} (runEveryNDays=${job.runEveryNDays})`)
        continue
      }
    }
    // If patterns (or pattern) and directory are specified - search files by masks with dateMode support
    if ((job.patterns || job.pattern) && job.directory) {
      const patterns = job.patterns || job.pattern
      const dateModes = job.dateMode || ['today', 'yesterday']
      const recursive = job.recursive === true
      files = findFilesByPatterns(job.directory, patterns, dateModes, recursive)
      logToFile(`Found ${files.length} files for job in directory ${job.directory}${recursive ? ' (recursive)' : ''}`)
      if (files.length === 0) {
        logToFile(`No files found for backup job in directory ${job.directory}${recursive ? ' (recursive)' : ''}. Job not completed.`)
        if (telegramConfig.botToken && telegramConfig.chatId) {
          const serverName = job.senderServerName || 'unknown'
          const serviceName = job.serviceName || 'unknown'
          const msg = `⚠️ <b>Backup Job Not Completed</b>\n\n<b>Server:</b> <code>${serverName}</code>\n<b>Service:</b> <code>${serviceName}</code>\n<b>Files found:</b> <b>0</b>\n\n<i>No files found for backup job. Job not completed.</i>`
          await sendTelegramMessage(msg, telegramConfig.botToken, telegramConfig.chatId)
        }
        continue
      }
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let fileToSend = file;
        // zip support
        if (job.zip) {
          fileToSend = await zipFile(file);
        }
        if (serverUnavailableRef.value) {
          filesNotTransferred += (files.length - i)
          break
        }
        try {
          await sendFileJob({ ...job, file: fileToSend }, telegramConfig, serverUnavailableRef)
          if (!serverUnavailableRef.value) {
            filesTransferred++
            consecutiveServerFails = 0
          } else {
            filesNotTransferred++
            consecutiveServerFails++
          }
        } catch (e) {
          jobFailed = true
          filesNotTransferred++
          consecutiveServerFails++
        }
        if (consecutiveServerFails >= maxConsecutiveFails) {
          serverUnavailableRef.value = true
          filesNotTransferred += (files.length - i - 1)
          break
        }
        // optionally, remove zip after send
        if (job.zip) {
          try { fs.unlinkSync(fileToSend) } catch {}
        }
        if (delayBetweenFilesMs && delayBetweenFilesMs > 0 && i < files.length - 1) {
          await new Promise(res => setTimeout(res, delayBetweenFilesMs))
        }
      }
      // After all files in job are sent and confirmed, rotate backup dirs
      if (!serverUnavailableRef.value) {
        try {
          await axios.post(`${job.serverUrl}/rotate-backup-dirs`, {
            senderServerName: job.senderServerName,
            serviceName: job.serviceName,
            rotationCount: job.rotationCount || 2
          }, {
            headers: {
              Authorization: job.token || config.token,
              'Content-Type': 'application/json'
            }
          })
          logToFile(`Backup rotation triggered for ${job.senderServerName}/${job.serviceName}`)
        } catch (e) {
          logToFile(`Failed to rotate backup dirs for ${job.senderServerName}/${job.serviceName}: ${e.message}`)
        }
      }
    } else if (job.archive && Array.isArray(job.archive.include)) {
      // Archive multiple folders/files with exclusions
      logToFile(`Archiving for job: ${job.senderServerName || job.serviceName}`)
      const archivePath = await zipMultipleWithExclude({
        ...job.archive,
        zip_catalog: job.zip_catalog
      })
      files = [archivePath]
      try {
        await sendFileJob({ ...job, file: archivePath }, telegramConfig)
      } catch (e) {
        jobFailed = true
      }
      try { fs.unlinkSync(archivePath) } catch {}
    } else if (job.file) {
      // Standard mode - send specific file
      logToFile(`Sending single file: ${job.file}`)
      files = [job.file]
      try {
        await sendFileJob(job, telegramConfig)
      } catch (e) {
        jobFailed = true
      }
    }
    // Send Telegram notification about job completion
    if (telegramConfig.botToken && telegramConfig.chatId) {
      const serverName = job.senderServerName || 'unknown'
      const serviceName = job.serviceName || 'unknown'
      let msg = ''
      if (serverUnavailableRef.value) {
        msg = `🚨 <b>Backup server not available anymore</b>\n\n<b>Server:</b> <code>${serverName}</code>\n<b>Service:</b> <code>${serviceName}</code>\n<b>Files transferred:</b> <b>${filesTransferred}</b>\n<b>Files not transferred:</b> <b>${filesNotTransferred}</b>\n\n<i>Backup server became unavailable during transfer. Please check server status.</i>`
      } else if (!jobFailed) {
        msg = `✅ <b>Backup Job Completed Successfully!</b>\n\n<b>Server:</b> <code>${serverName}</code>\n<b>Service:</b> <code>${serviceName}</code>\n<b>Files sent:</b> <b>${filesTransferred}</b>\n\n<i>All files have been successfully delivered to the server.</i>`
      } else {
        msg = `🚨 <b>Backup Job Failed!</b>\n\n<b>Server:</b> <code>${serverName}</code>\n<b>Service:</b> <code>${serviceName}</code>\n<b>Files processed:</b> <b>${filesTransferred + filesNotTransferred}</b>\n\n<i>Error occurred while sending one or more files.</i>`
      }
      await sendTelegramMessage(msg, telegramConfig.botToken, telegramConfig.chatId)
    }
  }
}

// Run once at startup
main()
