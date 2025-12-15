# Torque Empire CRM
Deployed with flat structure for Vercel.

## PowerShell one-liner to recreate UI files
From the repository root on Windows PowerShell, run the script to (re)create `srcApp.css` and `srcApp.js` with the latest stabilized content

```powershell
powershell -ExecutionPolicy Bypass -File .scriptssetup-crm-ui.ps1
```

## Development
Install dependencies and start the dev server

```bash
npm install
npm start
```