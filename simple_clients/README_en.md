# Simple Clients Usage Guide for Passive Backuper Server

## 1. Server Preparation

1. Make sure the Passive Backuper Server is running and configured (see main README.md):
   - PORT, HOST, TEMP_CATALOG, STORAGE_ROOT_DIR, CHUNK_SIZE, AUTH_TOKEN, etc.
2. Check that the server is listening on the correct port (default: 7111).

## 2. Client Preparation

In the `simple_clients` folder you will find three client options:
- `send_file_curl.sh` — Bash script (Linux/macOS, Windows via WSL)
- `send_file_powershell.ps1` — PowerShell script (Windows)
- `send_file_python.py` — Python script (cross-platform)

### Parameters for all clients:
- `<file>` — path to the file to send
- `<server_url>` — server address (e.g., http://127.0.0.1:7111)
- `<token>` — Bearer authorization token
- `<senderServerName>` — sender name (e.g., "test-client")
- `<serviceName>` — service name (e.g., "test-service")

## 3. Example Usage

### Bash (Linux/macOS/WSL)
```sh
chmod +x send_file_curl.sh
./send_file_curl.sh myfile.txt http://127.0.0.1:7111 "Bearer <TOKEN>" test-client test-service
```

### PowerShell (Windows)
```powershell
powershell -ExecutionPolicy Bypass -File .\send_file_powershell.ps1 -FilePath myfile.txt -ServerUrl http://127.0.0.1:7111 -Token "Bearer <TOKEN>" -Sender test-client -Service test-service
```

### Python (any OS)
```sh
pip install requests
python send_file_python.py myfile.txt http://127.0.0.1:7111 "Bearer <TOKEN>" test-client test-service
```

## 4. How to Test Locally

1. Start the server:
   ```sh
   node server.js
   ```
2. Generate a test file:
   ```sh
   head -c 120M </dev/urandom >testfile.bin   # Linux/macOS
   # or
   fsutil file createnew testfile.bin 125829120   # Windows
   ```
3. Send the file using any client (see above).
4. Check that the file appears in STORAGE_ROOT_DIR/<senderServerName>/<serviceName>/ on the server.
5. Compare checksums of the original and received file (md5sum, certutil, etc.).

## 5. Notes
- For large files, scripts automatically split the file into chunks (default 50 MB).
- Each chunk is sent as a separate POST request.
- The server assembles the file from chunks automatically.
- You can use any file type (text or binary) for testing.

---

If you need automated tests or additional client options — let me know!
