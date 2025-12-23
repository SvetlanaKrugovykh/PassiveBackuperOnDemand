/**
 * NetGateTunnel Client Wrapper for Passive Backuper
 * Initializes tunnel to expose local API through public WHITE_SERVER_HOST:WHITE_SERVER_PORT
 */

const { loadConfig } = require('./config')
const { createLogger } = require('./modules/logger')
const ControlClient = require('./modules/control-client')
const TunnelHandler = require('./modules/tunnel-handler')

class TunnelClient {
  constructor(logger = null) {
    this.config = loadConfig()
    this.logger = logger || createLogger({ name: 'tunnel-client', level: this.config.logLevel })
    this.controlClient = null
    this.tunnelHandler = null
    this.running = false
  }

  /**
   * Start the tunnel client
   */
  async start() {
    try {
      this.logger.info('Starting Tunnel Client...')
      this.logger.info({ config: this.sanitizeConfig(this.config) }, 'Configuration loaded')

      // Validate configuration
      this.validateConfig()

      // Initialize control client
      this.controlClient = new ControlClient(this.config, this.logger)

      // Initialize tunnel handler
      this.tunnelHandler = new TunnelHandler(this.config, this.logger, this.controlClient)

      // Setup event handlers
      this.setupEventHandlers()

      // Connect to server
      await this.controlClient.connect()

      // Register tunnels
      this.registerTunnels()

      this.running = true
      this.logger.info('Tunnel Client started successfully')
      this.printStatus()

      return true
    } catch (error) {
      this.logger.error({ error }, 'Failed to start tunnel client')
      throw error
    }
  }

  /**
   * Stop the tunnel client
   */
  async stop() {
    try {
      this.logger.info('Stopping Tunnel Client...')
      if (this.controlClient) {
        await this.controlClient.disconnect()
      }
      this.running = false
      this.logger.info('Tunnel Client stopped')
    } catch (error) {
      this.logger.error({ error }, 'Error stopping tunnel client')
    }
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    if (!this.config.serverHost) {
      throw new Error('WHITE_SERVER_HOST (SERVER_HOST) is required in .env')
    }

    if (!this.config.serverPort) {
      throw new Error('WHITE_SERVER_PORT (SERVER_PORT) is required in .env')
    }

    if (!this.config.authToken) {
      this.logger.warn('No AUTH_TOKEN configured - server may reject connection')
    }

    if (this.config.tunnels.length === 0) {
      throw new Error('No tunnels configured. Set TUNNELS environment variable (e.g., TUNNELS=7111:7111:backuper)')
    }

    this.logger.info({ tunnelCount: this.config.tunnels.length }, 'Tunnels configured')
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.controlClient.on('connected', () => {
      this.logger.info('Connected to tunnel server')
    })

    this.controlClient.on('disconnected', () => {
      this.logger.warn('Disconnected from tunnel server')
    })

    this.controlClient.on('reconnected', () => {
      this.logger.info('Reconnected to tunnel server, re-registering tunnels')
      this.registerTunnels()
    })

    this.controlClient.on('tunnelRegistered', (result) => {
      this.logger.info(
        { remotePort: result.remotePort, localPort: result.localPort, name: result.name },
        'Tunnel registered - accessible at ws://WHITE_SERVER_HOST:remotePort'
      )
    })

    this.controlClient.on('tunnelRegistrationFailed', (result) => {
      this.logger.error(
        { remotePort: result.remotePort, name: result.name, error: result.error },
        'Failed to register tunnel'
      )
    })

    this.tunnelHandler.on('error', (error) => {
      this.logger.error({ error }, 'Tunnel handler error')
    })
  }

  /**
   * Register tunnels
   */
  registerTunnels() {
    for (const tunnel of this.config.tunnels) {
      this.logger.info(
        { name: tunnel.name, localPort: tunnel.localPort, remotePort: tunnel.remotePort },
        'Registering tunnel'
      )
      this.controlClient.registerTunnel(tunnel)
    }
  }

  /**
   * Print tunnel status
   */
  printStatus() {
    this.logger.info('========================================')
    this.logger.info('Tunnel Configuration')
    this.logger.info('========================================')
    this.logger.info(`Server: ${this.config.serverHost}:${this.config.serverPort}`)
    this.logger.info('Tunnels:')
    for (const tunnel of this.config.tunnels) {
      this.logger.info(
        `  ${tunnel.name}: localhost:${tunnel.localPort} -> ${this.config.serverHost}:${tunnel.remotePort}`
      )
    }
    this.logger.info('========================================')
  }

  /**
   * Sanitize config for logging
   */
  sanitizeConfig(config) {
    return {
      serverHost: config.serverHost,
      serverPort: config.serverPort,
      tunnels: config.tunnels,
      logLevel: config.logLevel,
      // Don't log auth token
    }
  }
}

module.exports = TunnelClient
