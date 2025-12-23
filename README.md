# Passive Backuper Server

On-demand file retrieval service with chunk-based streaming and automatic tunnel exposure via public IP.

## What This Does

**Server runs on private IP, clients access via public IP through NetGateTunnel**

```
External Clients (Public IP)
        ↓
[NetGateTunnel] → White IP X.X.X.X:XXXX
        ↓↓ tunnel ↓↓
[This Server] → Private IP 127.0.0.1:7111
        ↓
[File System] → Search & stream files
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure .env

```env
# API Server
PORT = 7111
HOST = 127.0.0.1

# File Transfer
TEMP_CATALOG = C:\Temp\chunks\
CHUNK_SIZE = 52428800              # 50MB chunks
STORAGE_ROOT_DIR = D:\PassiveStorage\

# Authentication
ACCEPT_CREATING_ACCESS_TOKENS = true
TOKER_EXPIRE_IN_DAYS = 180

# Tunnel to Public IP
WHITE_SERVER_HOST = X.X.X.X
WHITE_SERVER_PORT = XXXX
AUTH_TOKEN = your-secret-token     # Coordinate with tunnel server admin
TUNNELS = 7111:7111:passive-backuper
TUNNEL_ENABLED = true
```

### 3. Run Server

```bash
node server.js
```

Expected output:
```
Service listening on http://127.0.0.1:7111
Starting Tunnel Client...
Tunnel registered - accessible at WHITE_SERVER_HOST:7111
```

Now external clients can call: `http://X.X.X.X:XXXX/get-files`

## API Endpoints

All endpoints require `Authorization` header (Bearer token).

### POST /get-files

**Search and retrieve files**

Request:
```json
{
  "senderServerName": "office-pc",
  "serviceName": "crm",
  "transferDescription": "Daily backup",
  "queries": [
    {
      "directory": "D:\\Data\\CRM",
      "pattern": "*.bak"
    }
  ]
}
```

Response:
- **Small files** (< 50MB): Returns full content in base64
- **Large files** (> 50MB): Returns chunk metadata for chunked download

### POST /fetch-chunk

**Get specific file chunk**

Request:
```json
{
  "fileName": "data.zip",
  "chunkId": 1
}
```

### POST /confirm-chunk

**Delete chunk after successful transfer**

Request:
```json
{
  "fileName": "data.zip",
  "chunkId": 1
}
```

### POST /confirm-file

**Delete file after successful transfer**

Request:
```json
{
  "fileName": "data.zip"
}
```

## Key Features

- **Chunk-based streaming** - Split large files into 50MB chunks
- **Pattern matching** - Regex-based file search
- **Token authentication** - JWT-based access control
- **Auto-tunnel exposure** - Private IP accessible via public white IP
- **Graceful shutdown** - Clean tunnel/server termination
- **Cross-platform** - Windows & Unix support
- **Storage organization** - Files organized by sender server and service name

## Architecture

```
src/
├── controllers/        # API endpoint handlers
├── guards/            # Authentication middleware
├── routes/            # Route definitions
├── schemas/           # Request validation schemas
├── services/          # Core file operations
├── plugins/           # Fastify plugins (auth)
└── tunnel/            # NetGateTunnel client integration
    ├── modules/       # Control client, tunnel handler, logger
    ├── common/        # Protocol definitions, utilities
    └── config.js      # Tunnel configuration loader
```

## Configuration Details

### Tunnel Parameters

| Variable | Purpose | Example |
|----------|---------|---------|
| `WHITE_SERVER_HOST` | Public IP of tunnel server | `X.X.X.X` |
| `WHITE_SERVER_PORT` | Port of tunnel server | `8778` |
| `AUTH_TOKEN` | Auth key for tunnel server | `abc123xyz` |
| `TUNNELS` | Port mapping (remote:local:name) | `7111:7111:passive-backuper` |
| `TUNNEL_ENABLED` | Enable/disable tunnel | `true` / `false` |

### File Transfer Parameters

| Variable | Purpose | Default |
|----------|---------|---------|
| `TEMP_CATALOG` | Temporary chunk storage | `C:\Temp\chunks\` |
| `CHUNK_SIZE` | Max chunk size in bytes | `52428800` (50MB) |
| `STORAGE_ROOT_DIR` | Root for organized storage | `D:\PassiveStorage\` |

## Troubleshooting

**See [TUNNEL_SETUP.md](TUNNEL_SETUP.md) for detailed tunnel troubleshooting.**

### Server won't start
- Check Node.js version: `node --version` (requires >= 16.x)
- Verify PORT 7111 is not in use
- Check .env file syntax

### Tunnel not connecting
- Verify WHITE_SERVER_HOST and WHITE_SERVER_PORT
- Confirm AUTH_TOKEN matches server config
- Check network connectivity to public IP
- Review logs in `C:\TEMP\logs\customBackuper.log`

### Files not found
- Verify directory path exists
- Check pattern syntax (regex-based)
- Ensure process has read permissions

## Requirements

- Node.js >= 16.x
- Windows or Unix operating system
- Write access to TEMP_CATALOG and STORAGE_ROOT_DIR
- Network connectivity to WHITE_SERVER_HOST:WHITE_SERVER_PORT

## Files & Logs

- **API Logs**: `C:\TEMP\logs\customBackuper.log`
- **Temp Files**: `C:\Temp\chunks\`
- **Storage**: `D:\PassiveStorage\`

## License

MIT
