# 🚀 DriveLegal — Deployment Guide

Complete step-by-step guide to deploy DriveLegal to production:
- **Backend + Ollama AI** → AWS EC2 `g4dn.xlarge` (GPU)
- **Web Frontend** → Netlify (free CDN)
- **Android APK** → EAS Build
- **iOS IPA** → EAS Build (requires Apple Developer account)

---

## Table of Contents

1. [Part 1: AWS EC2 — Backend + Ollama](#part-1-aws-ec2--backend--ollama)
2. [Part 2: Netlify — Web Frontend](#part-2-netlify--web-frontend)
3. [Part 3: Android APK — EAS Build](#part-3-android-apk--eas-build)
4. [Part 4: iOS IPA — EAS Build](#part-4-ios-ipa--eas-build)
5. [Part 5: Connect Everything](#part-5-connect-everything)
6. [Part 6: Monitoring & Troubleshooting](#part-6-monitoring--troubleshooting)

---

## Part 1: AWS EC2 — Backend + Ollama

### Step 1.1: Launch the EC2 Instance

1. **Go to AWS Console** → [EC2 Dashboard](https://console.aws.amazon.com/ec2/)
2. Click **"Launch Instance"**
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `DriveLegal-Server` |
| **AMI** | Ubuntu Server 22.04 LTS (x86_64) |
| **Instance Type** | `g4dn.xlarge` |
| **Key Pair** | Create new → download `.pem` file → **keep it safe!** |
| **Storage** | **100 GB** gp3 SSD (models need space) |
| **Security Group** | Create new with these rules ↓ |

**Security Group Rules:**

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP | Remote access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |
| Custom TCP | 8000 | 0.0.0.0/0 | FastAPI Backend |

4. Click **"Launch Instance"**
5. Wait for the instance to show **"Running"** status

> [!IMPORTANT]
> The `g4dn.xlarge` costs **~$0.526/hour**. To save money:
> - **Stop the instance** when not in use (you only pay for storage when stopped)
> - Consider **Spot Instances** (~$0.16/hour, 70% savings) for testing
> - Use **AWS Budgets** to set spending alerts

### Step 1.2: Connect via SSH

```bash
# Make your key file secure
chmod 400 your-key.pem

# Connect to the instance
ssh -i your-key.pem ubuntu@13.61.7.137
```

### Step 1.3: Upload Your Project

**Option A: Git Clone (recommended)**
```bash
# On the EC2 instance:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git ~/drivelegal
```

**Option B: SCP Upload (from your Windows PC)**
```powershell
# From your local machine (PowerShell):
scp -i your-key.pem -r "E:\drive sun\*" ubuntu@13.61.7.137:~/drivelegal/
```

### Step 1.4: Run the Setup Script

```bash
# On the EC2 instance:
cd ~/drivelegal

# Make the script executable
chmod +x scripts/setup-aws.sh

# Run WITHOUT a domain (uses raw IP):
sudo ./scripts/setup-aws.sh

# OR with a domain:
sudo ./scripts/setup-aws.sh api.drivelegal.in
```

> [!NOTE]
> The setup script will:
> - Install NVIDIA drivers + CUDA for the T4 GPU
> - Install Ollama and download the `llama3.1:8b` model
> - Set up Python virtual environment and install dependencies
> - Configure Nginx reverse proxy
> - Create a systemd service for auto-restart
> - Set up SSL with Let's Encrypt (if domain provided)
>
> **This takes about 20-30 minutes** (mostly downloading the AI model).

### Step 1.5: Verify Everything Works

```bash
# Check GPU is detected
nvidia-smi

# Check Ollama is running
ollama list

# Check backend service
sudo systemctl status drivelegal-backend

# Test the API
curl http://localhost:8000/health

# Test from outside (use your public IP)
curl http://13.61.7.137:8000/health
```

Expected health response:
```json
{
  "status": "ok",
  "agent_mode": "ollama/llama3.1:8b",
  "db_age": "...",
  "rules_count": 35,
  "chat_handler": "v3-memory"
}
```

### Step 1.6: Reboot (if needed)

If `nvidia-smi` shows an error after initial setup:
```bash
sudo reboot
# Wait 1-2 minutes, then SSH back in
ssh -i your-key.pem ubuntu@13.61.7.137
nvidia-smi  # Should work now
```

---

## Part 2: Netlify — Web Frontend

### Step 2.1: Create Netlify Account

1. Go to [netlify.com](https://www.netlify.com/) → **Sign Up** (free)
2. You can sign up with GitHub, GitLab, or email

### Step 2.2: Deploy — Option A: Connect GitHub (Auto-Deploy)

This is the **recommended approach** — every `git push` auto-deploys.

1. Push your code to GitHub:
   ```bash
   cd "E:\drive sun"
   git add .
   git commit -m "Add Netlify deployment config"
   git push origin main
   ```

2. In Netlify Dashboard:
   - Click **"Add new site"** → **"Import from Git"**
   - Select **GitHub** → authorize → select your repo
   - Configure build settings:

| Setting | Value |
|---------|-------|
| **Base directory** | `mobile` |
| **Build command** | `npx expo export --platform web` |
| **Publish directory** | `mobile/dist` |

3. Add Environment Variable:
   - Go to **Site Settings** → **Environment Variables**
   - Add: `EXPO_PUBLIC_API_URL` = `http://13.61.7.137:8000`

4. Click **"Deploy site"**

### Step 2.2: Deploy — Option B: Manual Upload

If you don't want to connect Git:

```powershell
# From your local machine (PowerShell):
cd "E:\drive sun\mobile"

# Set the API URL
$env:EXPO_PUBLIC_API_URL = "http://13.61.7.137:8000"

# Build the web export
npx expo export --platform web

# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Create new site and deploy
netlify init
netlify deploy --prod --dir=dist
```

### Step 2.3: Verify

Open the Netlify URL (e.g., `https://drivelegal.netlify.app`) in your browser.
- The web app should load
- Type a message like "What's the fine for no helmet?" → should get a response from your AWS backend

> [!TIP]
> **Custom Domain**: In Netlify Dashboard → Domain Settings → Add custom domain.
> You can use `drivelegal.com` or any domain you own.

---

## Part 3: Android APK — EAS Build

### Step 3.1: Install EAS CLI

```powershell
npm install -g eas-cli
```

### Step 3.2: Login to Expo

```powershell
cd "E:\drive sun\mobile"
eas login
# Enter your Expo account credentials (create one at expo.dev if needed)
```

### Step 3.3: Configure Project

```powershell
# Initialize EAS for this project (first time only)
eas build:configure
```

This will give you a `projectId` — copy it and update `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "YOUR_ACTUAL_PROJECT_ID_HERE"
  }
}
```

### Step 3.4: Update API URL

Edit `eas.json` and ensure the API URL matches your AWS IP:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "http://13.61.7.137:8000"
}
```

### Step 3.5: Build the APK

```powershell
cd "E:\drive sun\mobile"

# Build APK for testing (preview profile)
eas build --platform android --profile preview
```

> [!NOTE]
> - The first build takes **10-20 minutes** (EAS builds on their cloud servers)
> - When it finishes, you get a **download link** for the `.apk` file
> - You can also find all builds at [expo.dev/accounts/YOUR_NAME/builds](https://expo.dev)

### Step 3.6: Install APK

1. Download the APK from the link EAS gives you
2. Transfer to your Android phone (email, Google Drive, or USB)
3. Open the APK on your phone → Install (enable "Install from Unknown Sources" if prompted)
4. Open DriveLegal → test the AI chat!

### Step 3.7: Build for Play Store (AAB)

When you're ready for the Google Play Store:
```powershell
# Production build (Android App Bundle for Play Store)
eas build --platform android --profile production
```

---

## Part 4: iOS IPA — EAS Build

> [!WARNING]
> iOS builds require an **Apple Developer Program** membership ($99/year).
> Sign up at [developer.apple.com](https://developer.apple.com/programs/).

### Step 4.1: Configure Apple Credentials

```powershell
cd "E:\drive sun\mobile"

# EAS will prompt for your Apple ID and create certificates automatically
eas build --platform ios --profile preview
```

EAS will ask you to:
1. Enter your **Apple ID email**
2. Enter your **Apple Developer Team ID**
3. It will auto-create provisioning profiles and certificates

### Step 4.2: Build IPA

```powershell
# Build for TestFlight / Ad Hoc distribution
eas build --platform ios --profile preview
```

### Step 4.3: Submit to TestFlight

```powershell
# Submit the build to Apple TestFlight
eas submit --platform ios --profile production
```

### Step 4.4: Build for App Store

```powershell
# Production build for App Store
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

---

## Part 5: Connect Everything

### Summary of URLs

After deployment, you'll have:

| Component | URL |
|-----------|-----|
| Backend API | `http://13.61.7.137:8000` |
| Web App | `https://drivelegal.netlify.app` |
| API Docs | `http://13.61.7.137:8000/docs` |
| Health Check | `http://13.61.7.137:8000/health` |

### Update All API URLs

**1. Mobile `.env`** (for local development):
```
EXPO_PUBLIC_API_URL=http://13.61.7.137:8000
```

**2. EAS Build** (for APK/IPA builds) — already set in `eas.json`:
```json
"env": {
  "EXPO_PUBLIC_API_URL": "http://13.61.7.137:8000"
}
```

**3. Netlify** (for web frontend):
- Netlify Dashboard → Site Settings → Environment Variables
- Set `EXPO_PUBLIC_API_URL` = `http://13.61.7.137:8000`
- Trigger a re-deploy

---

## Part 6: Monitoring & Troubleshooting

### Useful SSH Commands

```bash
# ── Backend ──
sudo systemctl status drivelegal-backend    # Check status
sudo systemctl restart drivelegal-backend   # Restart
sudo journalctl -u drivelegal-backend -f    # Live logs
sudo journalctl -u drivelegal-backend -n 50 # Last 50 lines

# ── Ollama ──
sudo systemctl status ollama               # Check Ollama
ollama list                                # List models
ollama run llama3.1:8b "test"               # Quick test

# ── Nginx ──
sudo nginx -t                              # Test config
sudo systemctl reload nginx                # Reload config
sudo tail -f /var/log/nginx/error.log      # Error log

# ── GPU ──
nvidia-smi                                 # GPU status & memory
watch -n 1 nvidia-smi                      # Live GPU monitor

# ── System ──
htop                                       # CPU/RAM monitor
df -h                                      # Disk space
free -h                                    # Memory
```

### Common Issues

**1. "Connection refused" when calling the API**
```bash
# Check if backend is running
sudo systemctl status drivelegal-backend

# Check if port 8000 is listening
ss -tlnp | grep 8000

# Restart if needed
sudo systemctl restart drivelegal-backend
```

**2. "NVIDIA-SMI has failed" or "No GPU detected"**
```bash
# Reboot the instance (drivers need a reboot after install)
sudo reboot

# After reboot, verify
nvidia-smi
```

**3. "Ollama model not found"**
```bash
# Re-pull the model
ollama pull llama3.1:8b

# Check if Ollama is running
sudo systemctl status ollama
sudo systemctl restart ollama
```

**4. Web app shows but can't talk to API**
- Check the browser console for CORS errors
- Verify `EXPO_PUBLIC_API_URL` is set correctly in Netlify environment variables
- Make sure the EC2 Security Group allows port 8000 from `0.0.0.0/0`

**5. EAS Build fails**
```powershell
# Check build logs
eas build:list

# Try clearing cache
cd "E:\drive sun\mobile"
npx expo start -c  # Clear Expo cache
eas build --platform android --profile preview --clear-cache
```

### Cost Management

| Resource | Cost | How to Save |
|----------|------|-------------|
| g4dn.xlarge | ~$0.53/hr ($380/mo) | Stop when not in use, use Spot ($0.16/hr) |
| EBS Storage (100GB) | ~$8/mo | — |
| Netlify | Free | Free tier: 100GB bandwidth, 300 build min/mo |
| EAS Build | Free tier: 30 builds/mo | Enough for most projects |

**To stop the instance (saves money when not in use):**
```bash
# AWS CLI:
aws ec2 stop-instances --instance-ids i-YOUR_INSTANCE_ID

# Or just use the AWS Console → EC2 → Select instance → Stop
```

> [!TIP]
> You can create a **Lambda function** or **CloudWatch alarm** to auto-stop the instance at night and auto-start it in the morning. This can save 50-70% of costs.

---

## Quick Start Checklist

- [x] Launch g4dn.xlarge on AWS (Ubuntu 22.04, 100GB storage)
- [ ] SSH in and upload project files
- [ ] Run `sudo ./scripts/setup-aws.sh`
- [ ] Verify: `curl http://13.61.7.137:8000/health`
- [ ] Create Netlify account and deploy web frontend
- [ ] Set `EXPO_PUBLIC_API_URL` in Netlify environment variables
- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Run `eas build --platform android --profile preview` for APK
- [ ] Download and install APK on your phone
- [ ] (Optional) Run `eas build --platform ios --profile preview` for iOS
- [ ] 🎉 Everything deployed!
