require('dotenv').config()
const { app } = require('./index')
const fs = require('fs')
const path = require('path')

const HOST = process.env.HOST || '127.0.0.1'
const LOG_DIR = process.env.LOG_DIR || 'logs'
const logFile = path.join(LOG_DIR, process.env.LOG_FILE)

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = fs.createWriteStream(logFile, { flags: 'a' })
console.log = (...args) => {
  const message = `${new Date().toISOString()} [INFO]: ${args.join(' ')}\n`;
  process.stdout.write(message)
  logStream.write(message)
}

console.error = (...args) => {
  const message = `${new Date().toISOString()} [ERROR]: ${args.join(' ')}\n`;
  process.stderr.write(message)
  logStream.write(message)
}

app.listen({ port: process.env.PORT || 7111, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }

  console.log(`${new Date()}:[API] Service listening on ${address}`)
})



