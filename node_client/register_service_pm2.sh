#!/bin/bash
# Register PassiveBackuperClient as a pm2 service (Linux/Unix)
# Usage: ./register_service_pm2.sh

cd "$(dirname "$0")"
pm install pm2 -g
pm2 start send_files.js --name backuper-client
pm2 save
pm2 startup
