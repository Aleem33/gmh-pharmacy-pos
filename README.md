# GMH Pharmacy POS — Windows EXE Builder

## Step 1 — Install Node.js (one time only)
Download from https://nodejs.org → choose LTS → install

## Step 2 — Build your EXE

### Easiest: double-click BUILD.bat
Done. Your EXE will appear in the release/ folder.

### Or from terminal:
    npm install
    npm run electron:build

## Output (in release/ folder)
- GMH Pharmacy POS Setup.exe   — Windows installer with desktop shortcut
- GMH Pharmacy POS.exe         — Portable, no install needed

## Notes
- Internet required (Firebase login and data)
- If Windows shows SmartScreen warning: click "More info" → "Run anyway"
- DevTools open by default to help debug — remove the openDevTools() line in main.js once everything works
