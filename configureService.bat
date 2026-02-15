@echo off
echo Configuring PassiveBackuperServer service...
echo.

echo Setting automatic startup...
sc.exe config PassiveBackuperServer start= auto
if %errorlevel% equ 0 (
    echo [OK] Automatic startup configured
) else (
    echo [ERROR] Failed to set automatic startup
)

echo.
echo Adding dependency on frp-client...
sc.exe config PassiveBackuperServer depend= frp-client
if %errorlevel% equ 0 (
    echo [OK] Dependency configured
) else (
    echo [ERROR] Failed to set dependency
)

echo.
echo Setting delayed auto-start...
sc.exe config PassiveBackuperServer DelayedAutostart= yes
if %errorlevel% equ 0 (
    echo [OK] Delayed auto-start configured
) else (
    echo [ERROR] Failed to set delayed auto-start
)

echo.
echo ========================================
echo Configuration completed!
echo ========================================
echo.
echo Starting service...
net start PassiveBackuperServer
echo.
echo Service status:
sc.exe query PassiveBackuperServer
echo.
pause
