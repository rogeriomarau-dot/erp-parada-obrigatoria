@echo off
cd /d "%~dp0"
echo Instalando o programa de impressao...
call npm install
if not exist config.json copy config.exemplo.json config.json
echo.
echo Pronto. Agora abra o config.json, preencha e depois rode o iniciar.bat
pause
