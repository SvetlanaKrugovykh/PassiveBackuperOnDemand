require('dotenv').config()

const Service = require('node-windows').Service;
const { execSync } = require('child_process');

const SERVICE_NAME = 'PassiveBackuperServer';
const DEPENDENCY_SERVICE = 'frp-client';

const svc = new Service({
  name: SERVICE_NAME,
  description: 'Passive Backuper Server - File backup service with tunnel support',
  script: process.env.START_SCRIPT || __dirname + '\\server.js',
  logpath: process.env.LOG_DIR || 'C:\\TEMP\\logs',
  logfile: process.env.LOG_FILE || 'PassiveBackuperServer.log',
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
})

svc.on('install', () => {
  console.log(`✓ Service "${SERVICE_NAME}" installed successfully!`)
  
  try {
    // Configure automatic startup and dependency on frp-client
    console.log(`Setting up automatic startup and dependency on "${DEPENDENCY_SERVICE}"...`)
    
    // Set automatic startup
    execSync(`sc config ${SERVICE_NAME} start= auto`, { encoding: 'utf8' })
    console.log('✓ Automatic startup configured')
    
    // Add dependency on frp-client
    execSync(`sc config ${SERVICE_NAME} depend= ${DEPENDENCY_SERVICE}`, { encoding: 'utf8' })
    console.log(`✓ Dependency on "${DEPENDENCY_SERVICE}" configured`)
    
    // Set delayed auto-start for reliability
    execSync(`sc config ${SERVICE_NAME} DelayedAutostart= yes`, { encoding: 'utf8' })
    console.log('✓ Delayed auto-start configured (starts after frp-client)')
    
    console.log('\n========================================')
    console.log('Service registration completed!')
    console.log('========================================')
    console.log(`Service name: ${SERVICE_NAME}`)
    console.log(`Depends on: ${DEPENDENCY_SERVICE}`)
    console.log('Startup type: Automatic (Delayed Start)')
    console.log('\nTo start the service now, run:')
    console.log(`  net start ${SERVICE_NAME}`)
    console.log('\nOr use Services console (services.msc)')
    console.log('========================================\n')
    
  } catch (error) {
    console.error('Warning: Could not configure service dependencies:', error.message)
    console.log('You may need to run this script as Administrator')
    console.log('\nManual configuration:')
    console.log(`  sc config ${SERVICE_NAME} start= auto`)
    console.log(`  sc config ${SERVICE_NAME} depend= ${DEPENDENCY_SERVICE}`)
    console.log(`  sc config ${SERVICE_NAME} DelayedAutostart= yes`)
  }
})

svc.on('alreadyinstalled', () => {
  console.log(`Service "${SERVICE_NAME}" is already installed.`)
  console.log('To reinstall, first uninstall it:')
  console.log('  node uninstallService.js')
})

svc.on('error', (err) => {
  console.error('Service installation error:', err)
})

console.log(`Installing service "${SERVICE_NAME}"...`)
console.log(`Script: ${svc.script}`)
console.log(`Log path: ${svc.logpath}`)
console.log('\nPlease wait...\n')

svc.install()
