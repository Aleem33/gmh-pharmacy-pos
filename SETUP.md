# GMH Pharmacy POS — Setup Guide

## After unzipping, run these commands once (in order)

### Step 1 — Install Java (for keystore generation only)
```powershell
winget install EclipseAdoptium.Temurin.17.JDK
# Close and reopen PowerShell after this
```

### Step 2 — Install Node dependencies
```powershell
npm install --legacy-peer-deps
```

### Step 3 — Scaffold the Android project (one-time)
```powershell
npm run build:android:win
npx cap add android
npx cap sync android
```

### Step 4 — Initialize Git and push to GitHub
```powershell
git init
git add -A
git commit -m "chore: initial commit with Android support"
git remote add origin https://github.com/Aleem33/gmh-pharmacy-pos.git
git push -u origin main
```

### Step 5 — Generate Android signing keystore (one-time, keep this file safe!)
```powershell
keytool -genkeypair `
  -v `
  -keystore gmh-release.keystore `
  -alias gmh-pharmacy `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass YOUR_STORE_PASSWORD `
  -keypass YOUR_KEY_PASSWORD `
  -dname "CN=GMH Pharmacy, OU=Dev, O=GMH, L=Saddiqabad, S=Punjab, C=PK"
```

### Step 6 — Copy keystore as base64 to clipboard
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("gmh-release.keystore")) | Set-Clipboard
```

### Step 7 — Add secrets to GitHub
Go to: https://github.com/Aleem33/gmh-pharmacy-pos/settings/secrets/actions

Add these 5 secrets:
| Name                       | Value                                     |
|----------------------------|-------------------------------------------|
| GH_TOKEN                   | Your GitHub Personal Access Token        |
| ANDROID_KEYSTORE_BASE64    | (paste from clipboard after Step 6)      |
| ANDROID_KEY_ALIAS          | gmh-pharmacy                              |
| ANDROID_KEYSTORE_PASSWORD  | YOUR_STORE_PASSWORD (from Step 5)        |
| ANDROID_KEY_PASSWORD       | YOUR_KEY_PASSWORD (from Step 5)          |

GH_TOKEN needs scopes: repo + write:packages
Get one at: https://github.com/settings/tokens/new?scopes=repo,write:packages

---

## Every release (after setup is done)

```powershell
cd "C:\path\to\gmh-pharmacy-pos"

# 1. Bump version
npm version 1.0.9 --no-git-tag-version

# 2. Sync android with new build
npm run build:android:win
npx cap sync android

# 3. Commit, tag, push — triggers GitHub Actions
git add -A
git commit -m "release: v1.0.9"
git tag v1.0.9
git push origin main
git push origin v1.0.9
```

GitHub Actions will then build and publish:
- GMH-Pharmacy-POS-Setup-1.0.9.exe  (Windows installer)
- GMH-Pharmacy-POS-v1.0.9.apk       (Android APK)

Both appear automatically on: https://github.com/Aleem33/gmh-pharmacy-pos/releases
