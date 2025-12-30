const path = require('path')
const fs = require('fs')
const cron = require('node-cron')

const sendFiles = require('./send_files')

const configPath = path.join(__dirname, 'client.config.json')
function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
}

function runJobWithConfig(job) {
  // Pass job as env variable so send_files.js processes only this job
  process.env.JOB_OVERRIDE = JSON.stringify(job)
  require('./send_files')
}

function main() {
  const config = loadConfig()
  const jobs = config.jobs || []
  let hasCron = false
  for (const job of jobs) {
    if (job.cronSchedule) {
      hasCron = true
      cron.schedule(job.cronSchedule, () => {
        runJobWithConfig(job)
      }, { timezone: job.timezone || 'UTC' })
      console.log(`Scheduled job (${job.serviceName || job.file}) with cron: ${job.cronSchedule}`)
    }
  }
  if (!hasCron) {
    // If there are no cron jobs, just run all jobs as usual
    require('./send_files')
  }
}

main()
