@echo off
setlocal
cd /d "%~dp0"
python -m streamlit --version >nul 2>&1
if errorlevel 1 (
    echo Install Python and run: python -m pip install -r requirements.txt
    pause
    exit /b 1
)
python -m streamlit run app.py --server.address 127.0.0.1 --server.headless false
if errorlevel 1 pause
