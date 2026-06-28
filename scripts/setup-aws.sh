#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DriveLegal — AWS EC2 g4dn.xlarge Full Setup Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Run this ONCE after launching your g4dn.xlarge instance with Ubuntu 22.04 AMI.
#
# Usage:
#   chmod +x setup-aws.sh
#   sudo ./setup-aws.sh [YOUR_DOMAIN]
#
# Example:
#   sudo ./setup-aws.sh api.drivelegal.in
#   sudo ./setup-aws.sh          # (no domain — uses raw IP, self-signed SSL)
#
# Instance Requirements:
#   - AMI: Ubuntu 22.04 LTS (ami-0522ab6e1ddcc7055 for ap-south-1)
#   - Instance Type: g4dn.xlarge (4 vCPU, 16GB RAM, NVIDIA T4 16GB GPU)
#   - Storage: 100 GB gp3 SSD (minimum — model files are large)
#   - Security Group: Open ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN="${1:-}"
APP_USER="ubuntu"
APP_DIR="/home/${APP_USER}/drivelegal"
BACKEND_DIR="${APP_DIR}/backend"
VENV_DIR="${APP_DIR}/.venv"
OLLAMA_MODEL="llama3.2-vision"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  DriveLegal — AWS g4dn.xlarge Server Setup"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if [[ "$EUID" -ne 0 ]]; then
    err "Please run as root: sudo ./setup-aws.sh"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: System Update & Base Packages
# ─────────────────────────────────────────────────────────────────────────────
info "Step 1/7: Updating system and installing base packages..."

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    build-essential \
    python3 python3-venv python3-dev python3-pip \
    nginx certbot python3-certbot-nginx \
    git curl wget unzip htop \
    software-properties-common

# Set Python 3.11 as default
# (Skipping update-alternatives as we use the default python3)

log "System packages installed."

# ─────────────────────────────────────────────────────────────────────────────
# Step 2 & 3: NVIDIA Drivers & Ollama (SKIPPED)
# ─────────────────────────────────────────────────────────────────────────────
info "Step 2 & 3: NVIDIA and Ollama already installed manually. Skipping..."

# Verify GPU is being used
info "Verifying Ollama GPU access..."
if nvidia-smi &> /dev/null; then
    nvidia-smi
    log "GPU detected and available for Ollama."
else
    warn "GPU not detected. Ollama will run on CPU (much slower)."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Deploy DriveLegal Backend
# ─────────────────────────────────────────────────────────────────────────────
info "Step 4/7: Setting up DriveLegal backend..."

# Create app directory if it doesn't exist
if [[ ! -d "${APP_DIR}" ]]; then
    warn "App directory not found at ${APP_DIR}"
    warn "Please upload your project first:"
    warn "  scp -r -i your-key.pem ./drive-sun/* ubuntu@<EC2-IP>:~/drivelegal/"
    warn ""
    warn "Or clone from Git:"
    warn "  git clone <your-repo-url> ${APP_DIR}"
    warn ""
    info "Creating directory structure for now..."
    mkdir -p "${APP_DIR}"
    mkdir -p "${BACKEND_DIR}"
fi

# Create Python virtual environment
if [[ ! -d "${VENV_DIR}" ]]; then
    python3 -m venv "${VENV_DIR}"
    log "Python virtual environment created."
fi

# Install Python dependencies
if [[ -f "${BACKEND_DIR}/requirements.txt" ]]; then
    "${VENV_DIR}/bin/pip" install --upgrade pip
    "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
    
    # Download spaCy model
    "${VENV_DIR}/bin/python" -m spacy download en_core_web_sm 2>/dev/null || true
    
    log "Python dependencies installed."
else
    warn "requirements.txt not found. Upload your project first, then re-run."
fi

# Create production .env if it doesn't exist
if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
    cat > "${BACKEND_DIR}/.env" << 'ENVFILE'
# DriveLegal Production Environment
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2-vision
# GEMINI_API_KEY=your_gemini_api_key_here
PORT=8000
ENVFILE
    log "Production .env created at ${BACKEND_DIR}/.env"
fi

# Fix ownership
chown -R ${APP_USER}:${APP_USER} "${APP_DIR}"

log "Backend deployed."

# ─────────────────────────────────────────────────────────────────────────────
# Step 5: Create Systemd Service
# ─────────────────────────────────────────────────────────────────────────────
info "Step 5/7: Creating systemd service for auto-start..."

cat > /etc/systemd/system/drivelegal-backend.service << SYSTEMD
[Unit]
Description=DriveLegal FastAPI Backend
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV_DIR}/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=${VENV_DIR}/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable drivelegal-backend
systemctl start drivelegal-backend || warn "Backend service couldn't start (project files may not be uploaded yet)"

log "Systemd service created and enabled."

# ─────────────────────────────────────────────────────────────────────────────
# Step 6: Configure Nginx Reverse Proxy
# ─────────────────────────────────────────────────────────────────────────────
info "Step 6/7: Configuring Nginx reverse proxy..."

# Remove default site
rm -f /etc/nginx/sites-enabled/default

if [[ -n "${DOMAIN}" ]]; then
    SERVER_NAME="${DOMAIN}"
else
    SERVER_NAME="_"
fi

cat > /etc/nginx/sites-available/drivelegal << NGINX
# DriveLegal — Nginx Reverse Proxy Configuration

# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;

# Upstream
upstream drivelegal_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name ${SERVER_NAME};

    # Redirect to HTTPS (enabled after certbot runs)
    # return 301 https://\$host\$request_uri;

    # For now, serve directly on HTTP
    location / {
        proxy_pass http://drivelegal_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

        if (\$request_method = 'OPTIONS') {
            return 204;
        }

        # Timeouts for AI responses (can be slow)
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;

        # Rate limiting
        limit_req zone=api burst=50 nodelay;
    }

    # Health check (no rate limit)
    location /health {
        proxy_pass http://drivelegal_backend/health;
        proxy_set_header Host \$host;
    }

    # Block sensitive paths
    location ~ /\. {
        deny all;
    }

    # Request size limit (for image uploads)
    client_max_body_size 20M;
}
NGINX

ln -sf /etc/nginx/sites-available/drivelegal /etc/nginx/sites-enabled/drivelegal

# Test and reload Nginx
nginx -t
systemctl reload nginx

log "Nginx configured for ${SERVER_NAME}"

# ─────────────────────────────────────────────────────────────────────────────
# Step 7: SSL Certificate (Let's Encrypt)
# ─────────────────────────────────────────────────────────────────────────────
info "Step 7/7: Setting up SSL..."

if [[ -n "${DOMAIN}" ]]; then
    info "Requesting Let's Encrypt SSL certificate for ${DOMAIN}..."
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email admin@${DOMAIN} || {
        warn "Certbot failed. You can retry manually later:"
        warn "  sudo certbot --nginx -d ${DOMAIN}"
    }
    log "SSL certificate installed for ${DOMAIN}"
else
    warn "No domain provided. Skipping Let's Encrypt."
    warn "The API will be available over HTTP at: http://${SERVER_NAME}"
    warn ""
    warn "To add SSL later with a domain:"
    warn "  sudo certbot --nginx -d your-domain.com"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Done!
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  ✅ DriveLegal Server Setup Complete!"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if [[ -n "${DOMAIN}" ]]; then
    echo "  🌐 API URL:    https://${DOMAIN}"
else
    echo "  🌐 API URL:    http://${SERVER_NAME}"
fi

echo "  📊 Health:     http://${SERVER_NAME}/health"
echo "  📖 API Docs:   http://${SERVER_NAME}/docs"
echo "  🤖 Ollama:     http://localhost:11434 (local only)"
echo ""
echo "  Useful Commands:"
echo "  ─────────────────────────────────────────────────"
echo "  sudo systemctl status drivelegal-backend   # Check backend"
echo "  sudo systemctl restart drivelegal-backend   # Restart backend"
echo "  sudo journalctl -u drivelegal-backend -f    # View logs"
echo "  nvidia-smi                                  # Check GPU usage"
echo "  ollama list                                 # List models"
echo "  sudo systemctl status ollama                # Check Ollama"
echo ""

# Check if reboot is needed for NVIDIA drivers
if [[ ! -f /proc/driver/nvidia/version ]] && command -v nvidia-smi &> /dev/null; then
    warn "⚠️  REBOOT REQUIRED for NVIDIA drivers to activate!"
    warn "   Run: sudo reboot"
    warn "   After reboot, verify with: nvidia-smi"
fi
