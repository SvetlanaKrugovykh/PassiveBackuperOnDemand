# PassiveBackuperServer Windows Service Installation

## Overview

PassiveBackuperServer is a Windows service for automatic file backup with tunnel support via frp-client.

## Dependencies

The service depends on:
- **frp-client** - must start first to enable external access

## Service Installation

### 1. Remove Old Service (if installed)

```powershell
# Remove old custombackuper.exe service (if installed)
sc stop custombackuper.exe
sc delete custombackuper.exe

# Or remove new service for reinstallation
node uninstallService.js
```

### 2. Install New Service

**Important:** Run PowerShell or CMD **as Administrator**!

```powershell
# Install dependencies (if not already installed)
npm install

# Register service
node registerService.js
```

### 3. Verify Installation

```powershell
# Check service status
sc query PassiveBackuperServer

# Or via Get-Service
Get-Service PassiveBackuperServer

# Check dependencies
sc qc PassiveBackuperServer
```

## Service Management

### Start Service

```powershell
# Method 1: via net
net start PassiveBackuperServer

# Method 2: via sc
sc start PassiveBackuperServer

# Method 3: via PowerShell
Start-Service PassiveBackuperServer

# Method 4: via GUI
services.msc
# Find "Passive Backuper Server" and start it
```

### Stop Service

```powershell
# Method 1: via net
net stop PassiveBackuperServer

# Method 2: via sc
sc stop PassiveBackuperServer

# Method 3: via PowerShell
Stop-Service PassiveBackuperServer
```

### Restart Service

```powershell
# PowerShell
Restart-Service PassiveBackuperServer

# Or sequentially
net stop PassiveBackuperServer
net start PassiveBackuperServer
```

## Auto-Start Configuration

The service is automatically configured for auto-start during installation via `registerService.js`:

- **Startup Type:** Automatic (Delayed Start)
- **Dependency:** frp-client
- **Startup Order:**
  1. frp-client starts first
  2. PassiveBackuperServer starts after (with delay)

### Manual Configuration (if needed)

```powershell
# Set auto-start
sc config PassiveBackuperServer start= auto

# Add frp-client dependency
sc config PassiveBackuperServer depend= frp-client

# Set delayed auto-start (for reliability)
sc config PassiveBackuperServer DelayedAutostart= yes
```

## Logs

Service logs are saved to:
- **Path from .env:** `C:\TEMP\logs\PassiveBackuperServer.log`
- **System logs:** Event Viewer → Windows Logs → Application

### View Logs

```powershell
# View log file
Get-Content "C:\TEMP\logs\PassiveBackuperServer.log" -Tail 50 -Wait

# View logs via Event Viewer
eventvwr.msc
```

## Troubleshooting

### Service Won't Start

1. Check that frp-client is running:
```powershell
Get-Service frp-client
```

2. Check logs:
```powershell
Get-Content "C:\TEMP\logs\PassiveBackuperServer.log" -Tail 100
```

3. Check Event Viewer for system errors

### Reinstall Service

```powershell
# 1. Stop service
net stop PassiveBackuperServer

# 2. Uninstall service
node uninstallService.js

# 3. Reinstall
node registerService.js

# 4. Start service
net start PassiveBackuperServer
```

### Check Configuration

```powershell
# Full service information
sc qc PassiveBackuperServer

# Service status
sc query PassiveBackuperServer

# Service dependencies
sc enumdepend PassiveBackuperServer
```

## Configuration (.env)

Main parameters in `.env`:

```env
# Server
PORT = 8777
HOST = 127.0.0.1

# Logs
LOG_DIR = C:\\TEMP\\logs
LOG_FILE = PassiveBackuperServer.log

# Startup script
START_SCRIPT = D:\\01_Project_JS_NodeJS\\!!!_003_Passive_Backuper_Server\\server.js

# Tunnel (optional)
TUNNEL_ENABLED = true
```

## Verify Auto-Start on Boot

1. Reboot the computer
2. After boot, check service status:

```powershell
Get-Service frp-client, PassiveBackuperServer | Format-Table -AutoSize
```

Both services should be in "Running" status.

## Additional Information

- **Service Name:** PassiveBackuperServer
- **Description:** Passive Backuper Server - File backup service with tunnel support
- **Executable:** server.js via node.exe
- **Memory:** --max_old_space_size=4096

## Quick Access Commands

```powershell
# Status of all related services
Get-Service frp-client, PassiveBackuperServer | Format-Table -AutoSize

# Restart both services
Restart-Service frp-client, PassiveBackuperServer

# View logs in real-time
Get-Content "C:\TEMP\logs\PassiveBackuperServer.log" -Tail 50 -Wait
```
