require('dotenv').config()

const Service = require('node-windows').Service;

const SERVICE_NAME = 'PassiveBackuperServer';

const svc = new Service({
  name: SERVICE_NAME,
  script: process.env.START_SCRIPT || __dirname + '\\server.js'
})

svc.on('uninstall', () => {
  console.log(`✓ Service "${SERVICE_NAME}" uninstalled successfully!`)
  console.log('\nYou can now reinstall it with: node registerService.js')
})

svc.on('error', (err) => {
  console.error('Service uninstallation error:', err)
})

svc.on('doesnotexist', () => {
  console.log(`Service "${SERVICE_NAME}" is not installed.`)
})

console.log(`Uninstalling service "${SERVICE_NAME}"...`)
console.log('Please wait...\n')

svc.uninstall()
