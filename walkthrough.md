# 🚀 DriveLegal — Final Deployment & Operation Guide

We have successfully migrated the DriveLegal backend to a secure, permanent, production-ready environment on AWS EC2, configured the mobile app to communicate with it securely over HTTPS, and automated the backend startup.

---

## 📌 Top 4 Key Points for Operation

> [!IMPORTANT]
> ### 1. Server Availability Schedule (9:00 AM – 5:00 PM)
> To keep AWS EC2 costs low, **turn off the server outside of business hours**. You should only keep the instance running **from 9:00 AM to 5:00 PM (8 hours per day)**.
> * When stopped, you only pay a tiny fraction for storage (~$8/month), saving you hundreds of dollars per month on the active GPU instance!
> * See [How to Turn On/Off the Server](#how-to-turn-onoff-the-server) below.

> [!TIP]
> ### 2. Locked-In Permanent URL
> The mobile app is now configured to talk directly to your secure permanent URL:
> **`https://13.61.7.137.nip.io`**
> * Unlike the temporary Cloudflare tunnel links we used before, this link is permanently tied to your AWS server.
> * Because this URL is locked in, **you do not need to rebuild the app or generate new APKs** when you turn your local PC off or reboot AWS.

> [!NOTE]
> ### 3. Automated Backend Auto-Start
> We configured a system background service (`systemd`) on your AWS server.
> * Whenever you power on/start your AWS EC2 instance, the FastAPI program and reverse-proxy **will start running automatically in the background**.
> * You do not need to SSH in, open `tmux`, or run any python start commands manually anymore!

> [!WARNING]
> ### 4. Download and Install the Final APK
> The permanent build has finished compiling successfully!
> * Open this link on your Android device to install the permanent APK:
>   👉 **[Install Permanent APK](https://expo.dev/accounts/dk011/projects/drivelegal-mobile/builds/eae2a1f4-bb4e-4534-8108-147f97887d0d)**
> * Install this APK on your phone. Since it connects directly to `13.61.7.137.nip.io`, it will work seamlessly whenever the AWS server is running.

---

## 🛠️ How to Turn On/Off the Server (9 AM – 5 PM Schedule)

To manage the 9:00 AM to 5:00 PM schedule, you should control the instance state from the AWS Console:

### To Turn On the Server (9:00 AM)
1. Go to the [AWS EC2 Dashboard](https://console.aws.amazon.com/ec2/).
2. Click on **Instances (running)**.
3. Select your `DriveLegal-Server` instance.
4. Click **Instance state** (top-right) -> **Start instance**.
5. Wait 1–2 minutes. The backend system service will boot up and automatically connect. Your app is now online!

### To Turn Off the Server (5:00 PM)
1. Go to the [AWS EC2 Dashboard](https://console.aws.amazon.com/ec2/).
2. Select your `DriveLegal-Server` instance.
3. Click **Instance state** -> **Stop instance**.
4. The server will shut down safely. Your app will show offline until started again tomorrow morning.

---

## 📋 Technical Verification & Configuration Details

### 1. Mobile Config (`eas.json` & `.env`)
We modified the mobile configuration files to point to the secure AWS URL:
```json
// mobile/eas.json
"preview": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://13.61.7.137.nip.io"
  }
}
```

### 2. AWS Server Status Checking
If you ever want to check if the background service is running on AWS, you can SSH into the server and run:
```bash
# Check if the FastAPI service is running
sudo systemctl status drivelegal-backend

# Restart the backend service if needed
sudo systemctl restart drivelegal-backend

# View the real-time server logs
sudo journalctl -u drivelegal-backend -f
```

---

## 🏁 Summary of Artifacts and Links

* **Permanent APK (Works 9am-5pm with AWS server, PC can be turned off):** [EAS Build Installation Page](https://expo.dev/accounts/dk011/projects/drivelegal-mobile/builds/eae2a1f4-bb4e-4534-8108-147f97887d0d)
* **Production API Health Endpoint:** `https://13.61.7.137.nip.io/health`
* **Interactive API Documentation:** `https://13.61.7.137.nip.io/docs`
