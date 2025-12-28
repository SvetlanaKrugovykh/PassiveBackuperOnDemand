## Usage: .\send_file_powershell.ps1 -FilePath <file> -ServerUrl <url> -Token <token> -Sender <senderServerName> -Service <serviceName>
param(
    [string]$FilePath,
    [string]$ServerUrl,
    [string]$Token,
    [string]$Sender,
    [string]$Service
)

$ChunkSize = 52428800 # 50MB
$Bytes = [System.IO.File]::ReadAllBytes($FilePath)
$NumChunks = [math]::Ceiling($Bytes.Length / $ChunkSize)

for ($i = 0; $i -lt $NumChunks; $i++) {
    $Start = $i * $ChunkSize
    $Length = [math]::Min($ChunkSize, $Bytes.Length - $Start)
    $Chunk = $Bytes[$Start..($Start + $Length - 1)]
    $Base64Chunk = [Convert]::ToBase64String($Chunk)
    $Body = @{fileName = [IO.Path]::GetFileName($FilePath) chunkId = $i + 1 numChunks = $NumChunks content = $Base64Chunk senderServerName = $Sender serviceName = $Service} | ConvertTo-Json
    Invoke-RestMethod -Uri "$ServerUrl/fetch-chunk" -Headers @{Authorization = $Token} -Method Post -Body $Body -ContentType 'application/json'
}
