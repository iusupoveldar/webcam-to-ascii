@echo off
echo Building Rust to WebAssembly...
wasm-pack build --target web
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)
echo Build successful!
echo.
echo Starting local server...
echo Please open http://localhost:8000 in your browser.
python -m http.server 8000
pause
