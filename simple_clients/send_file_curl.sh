#!/bin/bash
## Usage: ./send_file_curl.sh <file> <server_url> <token> <senderServerName> <serviceName>
## Example: ./send_file_curl.sh myfile.txt http://X.X.X.X:XXXX "Bearer TOKEN" myserver myservice

FILE="$1"
SERVER_URL="$2"
TOKEN="$3"
SENDER="$4"
SERVICE="$5"
CHUNK_SIZE=52428800 # 50MB

if [ -z "$FILE" ] || [ -z "$SERVER_URL" ] || [ -z "$TOKEN" ] || [ -z "$SENDER" ] || [ -z "$SERVICE" ] then
  echo "Usage: $0 <file> <server_url> <token> <senderServerName> <serviceName>"
  exit 1
fi

FILE_SIZE=$(stat -c%s "$FILE")
NUM_CHUNKS=$(( (FILE_SIZE + CHUNK_SIZE - 1) / CHUNK_SIZE ))

for ((i=0; i<$NUM_CHUNKS; i++)) do
  OFFSET=$((i * CHUNK_SIZE))
  dd if="$FILE" bs=1 skip=$OFFSET count=$CHUNK_SIZE 2>/dev/null | base64 > chunk.b64
  CHUNK_CONTENT=$(cat chunk.b64)
  rm chunk.b64
  curl -X POST "$SERVER_URL/fetch-chunk" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"fileName\":\"$(basename $FILE)\",\"chunkId\":$((i+1)),\"numChunks\":$NUM_CHUNKS,\"content\":\"$CHUNK_CONTENT\",\"senderServerName\":\"$SENDER\",\"serviceName\":\"$SERVICE\"}"
done
