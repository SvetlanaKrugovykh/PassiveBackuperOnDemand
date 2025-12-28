# Node.js Simple Client for Passive Backuper

## Features
- Reads jobs from `client.config.json` (array of files and parameters)
- Splits files into chunks and sends to server with metadata
- Uses `node-cron` for optional scheduling
- Can be run as a Windows service (see below) or with pm2 on Unix

## Usage

1. Install dependencies:
   ```sh
   cd node_client
   npm install axios node-cron
   ```
2. Edit `client.config.json` to specify files, server URL, token, etc.
3. Run client:
   ```sh
   node send_files.js
   ```
4. (Optional) Schedule with cron: uncomment the cron line in `send_files.js` and adjust schedule.

## Windows Service
To run as a Windows service, use [nssm](https://nssm.cc/) or [pm2-windows-service](https://www.npmjs.com/package/pm2-windows-service):

- With nssm:
  1. Download and install nssm
  2. Run:
     ```sh
     nssm install PassiveBackuperClient "C:\Path\to\node.exe" "C:\Path\to\send_files.js"
     ```
  3. Start service from Windows Services panel

- With pm2 (cross-platform):
   ```sh
   npm install -g pm2
   pm2 start send_files.js --name backuper-client
   pm2 save
   pm2 startup
   ```

## Config Example (`client.config.json`)
```json
[
  {
    "file": "../testfile1.bin",
    "serverUrl": "http://127.0.0.1:7111",
    "token": "Bearer <TOKEN>",
    "senderServerName": "test-client",
    "serviceName": "test-service",
    "chunkSize": 52428800
  }
]
```

---

- No Python or shell scripts required.
- Works on Windows and Unix.
- Extend config for multiple files or schedules.
