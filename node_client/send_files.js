const fs = require('fs');
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

async function sendFileJob(job) {
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
          return;
        }
        await new Promise(res => setTimeout(res, 1000 * attempt)); // Exponential backoff
      }
    }
    chunkId++;
  }
}

async function main() {
  const jobs = loadConfig();
  for (const job of jobs) {
    await sendFileJob(job);
  }
}

// Run once at startup
main();

// Schedule with cron if needed (example: every day at 2:00)
// cron.schedule('0 2 * * *', main);
