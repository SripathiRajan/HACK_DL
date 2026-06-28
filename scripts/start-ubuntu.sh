#!/bin/bash
# DriveLegal - Ubuntu Server Startup Script

# Stop on errors
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$DIR")"
cd "$ROOT_DIR"

echo -e "\e[36m=== DriveLegal Ubuntu Remote Startup ===\e[0m"

# 1. Check Ollama
echo -e "\e[36mChecking Ollama...\e[0m"
if command -v ollama &> /dev/null; then
    echo -e "\e[32m[OK] Ollama is available\e[0m"
else
    echo -e "\e[33m[WARN] Ollama is not installed or running!\e[0m"
    echo -e "\e[33m       Please install Ollama: curl -fsSL https://ollama.com/install.sh | sh\e[0m"
fi

# 2. Start Backend API
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "\e[33mStopping previous process on port 8000...\e[0m"
    kill -9 $(lsof -t -i:8000) || true
    sleep 2
fi

echo -e "\e[36mStarting local backend on port 8000 in background...\e[0m"
# Check if venv exists, otherwise instruct user
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    echo -e "\e[31m[ERROR] Python virtual environment (.venv) not found. Please create it and install requirements.\e[0m"
    exit 1
fi
nohup python backend/main.py > backend.log 2>&1 &
sleep 5

# 3. Start Cloudflare Tunnel
echo -e "\e[36mStarting Cloudflare Tunnel for the backend API...\e[0m"
pkill -f cloudflared || true
rm -f cloudflare-tunnel.log

nohup npx -y cloudflared tunnel --url http://127.0.0.1:8000 > cloudflare-tunnel.log 2>&1 &

echo -e "\e[33mWaiting for Cloudflare tunnel to initialize...\e[0m"
TUNNEL_URL=""
for i in {1..30}; do
    sleep 2
    if grep -q "https://[a-z0-9\-]*\.trycloudflare\.com" cloudflare-tunnel.log; then
        TUNNEL_URL=$(grep -o "https://[a-z0-9\-]*\.trycloudflare\.com" cloudflare-tunnel.log | head -1)
        break
    fi
done

if [ -z "$TUNNEL_URL" ]; then
    echo -e "\e[31m[ERROR] Could not start Cloudflare tunnel.\e[0m"
    exit 1
fi

echo -e "\e[32m[OK] Backend exposed at: $TUNNEL_URL\e[0m"

# 4. Update mobile/.env
MOBILE_ENV="$ROOT_DIR/mobile/.env"
if [ -f "$MOBILE_ENV" ]; then
    grep -v '^EXPO_PUBLIC_API_URL' "$MOBILE_ENV" > "$MOBILE_ENV.tmp" || true
    mv "$MOBILE_ENV.tmp" "$MOBILE_ENV"
else
    touch "$MOBILE_ENV"
fi
echo "EXPO_PUBLIC_API_URL=$TUNNEL_URL" >> "$MOBILE_ENV"
echo -e "\e[32m[OK] Updated mobile/.env with tunnel URL\e[0m"

# 5. Start Expo
echo -e "\e[36mStarting Expo with Tunneling...\e[0m"
cd "$ROOT_DIR/mobile"
npx expo start --tunnel -c
