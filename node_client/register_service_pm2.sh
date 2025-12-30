#!/bin/bash
# Register PassiveBackuperClient as a pm2 service (Linux/Unix)
# Usage: ./register_service_pm2.sh

cd "$(dirname "$0")"
pm2 install pm2 -g
pm2 start send_files_cron.js --name backuper-client
pm2 save
pm2 startup
