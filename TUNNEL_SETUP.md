# NetGateTunnel Integration Guide

## Overview

Passive Backuper Server now operates as a **NetGateTunnel Client**. The server runs on an **internal (private) IP**, while access from a public IP is enabled through the NetGateTunnel.

## Architecture

```
External Clients (Public IP)
        ↓
[NetGateTunnel Server]  (WHITE_SERVER_HOST:WHITE_SERVER_PORT = X.X.X.X:XXXX)
        ↓
[NetGateTunnel Client]  ← Passive Backuper (this project)
        ↓
[Passive Backuper API]  (localhost:7111 on private IP)
```

## Configuration

### 1. Install Dependencies

```bash
npm install
```

Tunnel dependencies added:
- `ws` - WebSocket for tunnel communication
- `pino` - structured logging for tunnel
- `uuid` - unique identifiers

### 2. Update .env

Required tunnel parameters:

```env
# NetGateTunnel Client Configuration
WHITE_SERVER_HOST = X.X.X.X                # Public IP of tunnel server
WHITE_SERVER_PORT = 8000                   # Port of tunnel server
AUTH_TOKEN = your-secret-token-here        # Authentication token (must match server)
TUNNELS = 7111:7111:passive-backuper       # remotePort:localPort:name
TUNNEL_ENABLED = true                      # Enable/disable tunnel
```

### 3. Understanding TUNNELS Parameter

Format: `remotePort:localPort:name` or `remotePort:localPort`

For Passive Backuper:
- **remotePort** = `7111` - port the tunnel listens on at WHITE_SERVER_HOST
- **localPort** = `7111` - local port on private IP (Passive Backuper API)
- **name** = `passive-backuper` - tunnel name for logging

Result:
```
External client → http://X.X.X.X:XXXX/get-files (through tunnel)
        ↓
Tunnel redirects → localhost:7111/get-files (private IP)
```

## Running

### Method 1: Direct Run (for testing)

```bash
node server.js
```

Output:
```
2025-12-23T10:30:45.123Z [INFO]: Service listening on http://127.0.0.1:7111
2025-12-23T10:30:46.456Z [INFO]: Starting Tunnel Client...
2025-12-23T10:30:47.789Z [INFO]: Connected to tunnel server
2025-12-23T10:30:48.012Z [INFO]: Tunnel registered - accessible at ws://WHITE_SERVER_HOST:7111
```

### Method 2: As Windows Service (with node-windows)

Using existing `registerService.js` if needed:
```bash
node registerService.js
```

## Troubleshooting

### Tunnel not connecting

**Check:**
1. WHITE_SERVER_HOST and WHITE_SERVER_PORT are correct
2. NetGateTunnel Server is running and accessible
3. AUTH_TOKEN matches server configuration
4. Port 8000 is not blocked on public server

**Tunnel logs:**
```bash
# In server.js output, look for lines with "Tunnel Client" or "tunnel-client"
# Tunnel will attempt to reconnect automatically (RECONNECT_ATTEMPTS=999)
```

### Server listening but tunnel not working

1. Check TUNNEL_ENABLED in .env (should be `true`)
2. Review log file: `C:\TEMP\logs\customBackuper.log`
3. Verify tunnel configuration:
```javascript
// src/tunnel/config.js reads:
WHITE_SERVER_HOST  // or SERVER_HOST
WHITE_SERVER_PORT  // or SERVER_PORT
TUNNELS
AUTH_TOKEN
```

## Requests from Public IP

After successful startup and tunnel connection:

```bash
# From public IP, calling through tunnel:
curl -X POST http://X.X.X.X:XXXX/get-files \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "senderServerName": "office-pc",
    "serviceName": "crm",
    "transferDescription": "Daily backup",
    "queries": [
      {"directory": "D:\\Data", "pattern": "*.bak"}
    ]
  }'

# Tunnel automatically redirects to localhost:7111/get-files
```

## Additional .env Variables (optional)

```env
# Tunnel logging
LOG_LEVEL = debug                  # trace, debug, info, warn, error

# Reconnection
CONNECTION_TIMEOUT = 10000         # milliseconds
RECONNECT_ATTEMPTS = 999           # attempts (999 = infinite)
RECONNECT_DELAY = 5000             # milliseconds initial delay
RECONNECT_MAX_DELAY = 60000        # milliseconds max delay

# Local connection
DATA_HOST = localhost              # address for tunnel connection
LOCAL_HOST = localhost             # local address
```

## File Architecture

```
src/tunnel/
├── index.js                     # Main TunnelClient wrapper
├── config.js                    # Configuration loader
├── modules/
│   ├── control-client.js       # WebSocket client for control plane
│   ├── tunnel-handler.js       # Tunnel handler (proxying)
│   └── logger.js               # Logging (pino-based)
└── common/
    ├── protocol.js             # Message protocol
    └── utils.js                # Utilities (retry, etc.)
```

## Startup Flow (server.js)

1. Load `.env`
2. Start Fastify on `HOST:PORT` (127.0.0.1:7111)
3. Log "Service listening on..."
4. After 1 second, initialize TunnelClient (if `TUNNEL_ENABLED=true`)
5. TunnelClient connects to WHITE_SERVER_HOST:WHITE_SERVER_PORT
6. Register tunnel (7111:7111:passive-backuper)
7. External clients can now access through public IP

## Shutdown

**Graceful shutdown:**
- CTRL+C sends SIGINT
- Server closes tunnel properly
- Then exits process

## Notes

- Tunnel runs in background independently from main API
- If tunnel disconnects, server continues running locally
- Tunnel reconnection is automatic
- Maximum 999 reconnection attempts (configurable)

## Configuration Coordination

Tunnel parameters must be coordinated with NetGateTunnel server administrator:
- WHITE_SERVER_HOST
- WHITE_SERVER_PORT
- AUTH_TOKEN
- Available remote ports
