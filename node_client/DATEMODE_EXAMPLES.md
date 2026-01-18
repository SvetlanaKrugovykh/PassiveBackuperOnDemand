# Примеры использования режима dateMode

## Гибридный режим `today/yesterday`

Новый режим позволяет автоматически переключаться с поиска файлов за сегодня на вчерашние, если за сегодня ничего не найдено.

### Как работает

1. **Сначала** ищет файлы за сегодняшнюю дату
2. **Если найдены** — отправляет их, работает как обычный режим `today`
3. **Если НЕ найдены** — автоматически ищет файлы за вчерашнюю дату
4. **Уведомление в Telegram** — если сработал fallback на yesterday, в сообщении появится предупреждение

### Примеры конфигурации

#### Пример 1: Простой гибридный режим
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

#### Пример 2: С кастомным форматом даты
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

#### Пример 3: Рекурсивный поиск с гибридным режимом
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

## Сравнение режимов

### Стандартный режим `["today", "yesterday"]`
```json
{
  "dateMode": ["today", "yesterday"]
}
```
- Ищет файлы за **оба** дня
- Отправляет **все найденные** файлы (и today, и yesterday)
- Не показывает, какие файлы за какой день

### Гибридный режим `"today/yesterday"`
```json
{
  "dateMode": "today/yesterday"
}
```
- Ищет файлы **только за today**
- Если не нашел — ищет **только за yesterday**
- Отправляет файлы **только за один** день
- В Telegram уведомлении показывает, если сработал fallback

### Только сегодня `["today"]`
```json
{
  "dateMode": ["today"]
}
```
- Ищет файлы **только за today**
- Если не нашел — **ничего не отправляет**

## Примеры Telegram-уведомлений

### Когда найдены файлы за сегодня
```
✅ Backup Job Completed Successfully!

Server: production-server
Service: daily-backup
Files sent: 3

All files have been successfully delivered to the server.
```

### Когда сработал fallback на yesterday
```
✅ Backup Job Completed Successfully!

Server: production-server
Service: daily-backup
Files sent: 2

⚠️ Note: Files from yesterday were used (no files found for today).

All files have been successfully delivered to the server.
```

### Когда файлы не найдены вообще
```
⚠️ Backup Job Not Completed

Server: production-server
Service: daily-backup
Files found: 0

No files found for backup job. Job not completed.
```

## Когда использовать гибридный режим

### ✅ Используйте `today/yesterday`:
- Когда файлы могут создаваться с задержкой
- Когда важно иметь хотя бы последний доступный бэкап
- Когда нужно знать, за какой день реально отправлены файлы
- Для критичных ежедневных бэкапов

### ❌ НЕ используйте `today/yesterday`:
- Когда нужны файлы строго за сегодня
- Когда нужны файлы за оба дня одновременно
- Когда важно избежать дублирования при повторном запуске

## Логирование

В логах будет видно, когда сработал fallback:

```
[2026-01-18T10:00:00.000Z] Found 0 files for job in directory C:/Backups/
[2026-01-18T10:00:01.000Z] Found 2 files for job in directory C:/Backups/ (used yesterday fallback)
```
