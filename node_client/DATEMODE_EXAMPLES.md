# dateMode Usage Examples

## Hybrid Mode `today/yesterday`

This new mode automatically switches from searching for today's files to yesterday's files if nothing is found for today.

### How It Works

1. **First** searches for files with today's date
2. **If found** — sends them, works like regular `today` mode
3. **If NOT found** — automatically searches for files with yesterday's date
4. **Telegram notification** — if fallback to yesterday occurs, a warning appears in the message

### Configuration Examples

#### Example 1: Simple Hybrid Mode
```json
{
  "pattern": "backup_{date}.zip",
  "directory": "C:/Backups/",
  "serverUrl": "http://backup-server:8777",
  "senderServerName": "production-server",
  "serviceName": "daily-backup",
  "dateMode": "today/yesterday",
  "cronSchedule": "0 2 * * *"
}
```

#### Example 2: Custom Date Format
```json
{
  "pattern": "db_dump_{date:yyyy-mm-dd}.sql",
  "directory": "D:/Database/Dumps/",
  "serverUrl": "http://backup-server:8777",
  "senderServerName": "db-server",
  "serviceName": "postgres-backup",
  "dateMode": "today/yesterday",
  "cronSchedule": "0 3 * * *"
}
```

#### Example 3: Recursive Search with Hybrid Mode
```json
{
  "patterns": ["*.log", "*.txt"],
  "directory": "C:/Logs/",
  "recursive": true,
  "serverUrl": "http://backup-server:8777",
  "senderServerName": "app-server",
  "serviceName": "logs-backup",
  "dateMode": "today/yesterday",
  "cronSchedule": "0 4 * * *"
}
```

## Mode Comparison

### Standard Mode `["today", "yesterday"]`
```json
{
  "dateMode": ["today", "yesterday"]
}
```
- Searches for files from **both** days
- Sends **all found** files (both today and yesterday)
- Does not indicate which files are from which day

### Hybrid Mode `"today/yesterday"`
```json
{
  "dateMode": "today/yesterday"
}
```
- Searches for files **only from today**
- If not found — searches **only from yesterday**
- Sends files from **only one** day
- Telegram notification shows if fallback occurred

### Today Only `["today"]`
```json
{
  "dateMode": ["today"]
}
```
- Searches for files **only from today**
- If not found — **sends nothing**

## Telegram Notification Examples

### When Today's Files Are Found
```
✅ Backup Job Completed Successfully!

Server: production-server
Service: daily-backup
Files sent: 3

All files have been successfully delivered to the server.
```

### When Fallback to Yesterday Occurred
```
✅ Backup Job Completed Successfully!

Server: production-server
Service: daily-backup
Files sent: 2

⚠️ Note: Files from yesterday were used (no files found for today).

All files have been successfully delivered to the server.
```

### When No Files Are Found
```
⚠️ Backup Job Not Completed

Server: production-server
Service: daily-backup
Files found: 0

No files found for backup job. Job not completed.
```

## When to Use Hybrid Mode

### ✅ Use `today/yesterday`:
- When files may be created with delays
- When it's important to have at least the latest available backup
- When you need to know which day's files were actually sent
- For critical daily backups

### ❌ DO NOT use `today/yesterday`:
- When you need files strictly from today
- When you need files from both days simultaneously
- When avoiding duplication on repeated runs is important

## Logging

Logs will show when fallback occurred:

```
[2026-01-18T10:00:00.000Z] Found 0 files for job in directory C:/Backups/
[2026-01-18T10:00:01.000Z] Found 2 files for job in directory C:/Backups/ (used yesterday fallback)
```
