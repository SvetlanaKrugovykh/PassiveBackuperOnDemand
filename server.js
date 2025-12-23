require('dotenv').config()
const { app } = require('./index')
const fs = require('fs')
const path = require('path')
const TunnelClient = require('./src/tunnel')

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

  try {
    tunnelClient = new TunnelClient()
    await tunnelClient.start()
    console.log('Tunnel client initialized successfully')
  } catch (error) {
    console.error('Failed to initialize tunnel client:', error.message)
    // Don't exit - allow server to run without tunnel
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
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  if (tunnelClient && tunnelClient.running) {
    await tunnelClient.stop()
  }
  process.exit(0)
})

