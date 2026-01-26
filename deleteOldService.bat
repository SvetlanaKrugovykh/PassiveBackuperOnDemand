@echo off
echo Deleting old custombackuper.exe service...
sc.exe delete custombackuper.exe
if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Old service deleted successfully!
    echo.
) else (
    echo.
    echo [ERROR] Failed to delete service. Make sure you run this as Administrator!
    echo.
)
pause
