const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');

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
    chunkSize = 52428800
  } = job;
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    return;
  }
  const stat = fs.statSync(file);
  const fileSize = stat.size;
  const numChunks = Math.ceil(fileSize / chunkSize);
  const fileName = path.basename(file);
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
      serviceName
    };
    try {
      const resp = await axios.post(`${serverUrl}/fetch-chunk`, data, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json'
        }
      });
      console.log(`Sent chunk ${chunkId}/${numChunks} for ${fileName}: ${resp.status}`);
    } catch (e) {
      console.error(`Error sending chunk ${chunkId} for ${fileName}:`, e.message);
      return;
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
