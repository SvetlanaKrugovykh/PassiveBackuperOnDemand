const fs = require('fs');
const sendTelegramMessage = require('./send_telegram');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const crypto = require('crypto');
// Simple file logger
function logToFile(msg) {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'client.log');
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
}

const configPath = path.join(__dirname, 'client.config.json');

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function getTelegramConfig() {
  const config = loadConfig();
  return {
    botToken: config.telegramBotToken,
    chatId: config.telegramChatId
  };
}

function getDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}`;
}

function findFilesByPattern(directory, pattern, days = [0, -1]) {
  let files = [];
  for (const day of days) {
    const dateStr = getDateStr(day);
    const mask = pattern.replace('{date}', dateStr);
    // Convert mask to regex
    const regex = new RegExp('^' + mask.replace(/\./g, '\.').replace(/\*/g, '.*') + '$');
    if (fs.existsSync(directory)) {
      for (const file of fs.readdirSync(directory)) {
        if (regex.test(file)) {
          files.push(path.join(directory, file));
        }
      }
    }
  }
  return files;
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
  } = job;
  if (!fs.existsSync(file)) {
    logToFile(`File not found: ${file}`);
    return;
  }
  const stat = fs.statSync(file);
  const fileSize = stat.size;
  const numChunks = Math.ceil(fileSize / chunkSize);
  const fileName = path.basename(file);
  // Calculate sha256 for the file
  const fileBuffer = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  logToFile(`File ${file} sha256: ${hash}`);
  const readStream = fs.createReadStream(file, { highWaterMark: chunkSize });
  let chunkId = 1;
  let failed = false;
  for await (const chunk of readStream) {
    const b64 = chunk.toString('base64');
    const data = {
      fileName,
      chunkId,
      numChunks,
      content: b64,
      senderServerName,
      serviceName,
      sha256: hash
    };
    let sent = false;
    let attempt = 0;
    while (!sent && attempt < maxRetries) {
      try {
        const resp = await axios.post(`${serverUrl}/fetch-chunk`, data, {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json'
          }
        });
        logToFile(`Sent chunk ${chunkId}/${numChunks} for ${fileName}: ${resp.status}`);
        sent = true;
      } catch (e) {
        attempt++;
        logToFile(`Error sending chunk ${chunkId} for ${fileName} (attempt ${attempt}): ${e.message}`);
        if (attempt >= maxRetries) {
          logToFile(`Failed to send chunk ${chunkId} for ${fileName} after ${maxRetries} attempts.`);
          failed = true;
          // Send Telegram notification about failure (connection issue)
          if (telegramConfig.botToken && telegramConfig.chatId) {
            await sendTelegramMessage(
              '🚨 <b>File transfer failed</b>!\nClient <b>' + senderServerName + '</b> could not connect to the server for file <b>' + fileName + '</b>. Please check the server status.',
              telegramConfig.botToken,
              telegramConfig.chatId
            );
          }
          return;
        }
        await new Promise(res => setTimeout(res, 1000 * attempt)); // Exponential backoff
      }
    }
    chunkId++;
  }
  // If all chunks sent and not failed, send success notification
  if (!failed && telegramConfig.botToken && telegramConfig.chatId) {
    await sendTelegramMessage(
      '📦 <b>File transfer complete</b>!\nAll files from client <b>' + senderServerName + '</b> have been successfully delivered to the server.',
      telegramConfig.botToken,
      telegramConfig.chatId
    );
  }
}

async function main() {
  const config = loadConfig();
  const telegramConfig = getTelegramConfig();
  const jobs = config.jobs || config;
  for (const job of jobs) {
    // Если указан pattern и directory — ищем файлы по маске за сегодня и вчера
    if (job.pattern && job.directory) {
      const files = findFilesByPattern(job.directory, job.pattern, [0, -1]);
      for (const file of files) {
        await sendFileJob({ ...job, file }, telegramConfig);
      }
    } else if (job.file) {
      // Обычный режим — отправить конкретный файл
      await sendFileJob(job, telegramConfig);
    }
  }
}

// Run once at startup
main();

// Schedule with cron if needed (example: every day at 2:00)
// cron.schedule('0 2 * * *', main);
