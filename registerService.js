require('dotenv').config()

const Service = require('node-windows').Service;

const svc = new Service({
  name: 'customBackuper',
  description: 'Custom Backuper service',
  script: 'D:\\01_Project_JS_NodeJS\\!!!_003_Passive_Backuper_Server\\server.js',
  logpath: process.env.LOG_DIR,
  logfile: process.env.LOG_FILE,
  nodeOptions: [
    '--max_old_space_size=4096'
  ]
})

svc.on('install', () => {
  console.log('Service installed')
  console.log('You can now start the service from the Services console.')
  // svc.start()
})

svc.install()
