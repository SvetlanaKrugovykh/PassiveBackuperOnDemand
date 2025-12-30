// Windows service registration for Node.js client using node-windows
const Service = require('node-windows').Service
const path = require('path')

const svc = new Service({
  name: 'PassiveBackuperClient',
  description: 'Passive Backuper Client with cron support',
  script: path.join(__dirname, 'send_files_cron.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  // Uncomment and set if you want to run as a specific user
  // user: {
  //   account: 'username',
  //   password: 'password',
  //   domain: 'DOMAIN'
  // }
})

svc.on('install', function () {
  svc.start()
  console.log('Service installed and started.')
})

svc.on('alreadyinstalled', function () {
  console.log('Service is already installed.')
})

svc.on('start', function () {
  console.log('Service started.')
})

svc.on('error', function (err) {
  console.error('Service error:', err)
})

svc.install()
