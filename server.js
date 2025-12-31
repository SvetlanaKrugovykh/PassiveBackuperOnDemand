require('dotenv').config()
const { app } = require('./index')
const fs = require('fs')
const path = require('path')

//  reverse-tunnel-client, TUNNEL_ENABLED=true
let TunnelClient = null
let reverseTunnelProcess = null
try {
  TunnelClient = require('./src/tunnel')
} catch {}

const HOST = process.env.HOST || '127.0.0.1'
const PORT = process.env.PORT || 7111
const LOG_DIR = process.env.LOG_DIR || 'logs'
const LOG_FILE = process.env.LOG_FILE
const Platform_OS = process.env.Platform_OS || 'FreeBSD'
const TUNNEL_ENABLED = process.env.TUNNEL_ENABLED === 'true'

let tunnelClient = null

function setupLogging() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }

  const logFile = path.join(LOG_DIR, LOG_FILE)
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  console.log = (...args) => {
    const message = `${new Date().toISOString()} [INFO]: ${args.join(' ')}\n`
    process.stdout.write(message)
    logStream.write(message)
  }

  console.error = (...args) => {
    const message = `${new Date().toISOString()} [ERROR]: ${args.join(' ')}\n`
    process.stderr.write(message)
    logStream.write(message)
  }
}


async function initTunnel() {
  if (!TUNNEL_ENABLED) {
    console.log('Tunnel is disabled (TUNNEL_ENABLED != true)')
    return
  }

  // reverse-tunnel-client.js
  const reverseTunnelPath = './reverse-tunnel-client.js'
  const fs = require('fs')
  if (fs.existsSync(reverseTunnelPath)) {
    console.log('Starting reverse-tunnel-client.js...')
    const { fork } = require('child_process')
    reverseTunnelProcess = fork(reverseTunnelPath, [], { stdio: 'inherit' })
    reverseTunnelProcess.on('exit', (code) => {
      console.log('reverse-tunnel-client.js exited with code', code)
    })
    return
  }

  // Если reverse-tunnel-client.js не найден, пробуем старый TunnelClient
  if (TunnelClient) {
    try {
      tunnelClient = new TunnelClient()
      await tunnelClient.start()
      console.log('Tunnel client initialized successfully')
    } catch (error) {
      console.error('Failed to initialize tunnel client:', error.message)
      // Don't exit - allow server to run without tunnel
    }
  }
}

if (Platform_OS === 'Windows') {
  setupLogging()
}

app.listen({ port: PORT, host: HOST }, async (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }

  console.log(`${new Date()}:[API] Service listening on ${address}`)
    console.log('DEBUG_SOURCE_FILE:', process.env.DEBUG_SOURCE_FILE)

  // Initialize tunnel after server starts
  if (TUNNEL_ENABLED) {
    setTimeout(() => {
      initTunnel()
    }, 1000)
  }
})

// Graceful shutdown

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...')
  if (tunnelClient && tunnelClient.running) {
    await tunnelClient.stop()
  }
  if (reverseTunnelProcess) {
    reverseTunnelProcess.kill()
  }
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  if (tunnelClient && tunnelClient.running) {
    await tunnelClient.stop()
  }
  if (reverseTunnelProcess) {
    reverseTunnelProcess.kill()
  }
  process.exit(0)
})

