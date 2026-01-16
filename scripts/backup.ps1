# ================================
# AI PRO CRM – SAFE BACKUP SCRIPT
# ================================

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"

$sourcePath = "C:\Users\user\Desktop\ai_pro_crm_clean"
$backupRoot = "C:\Users\user\Desktop\ai_pro_crm_autobackups"
$backupPath = "$backupRoot\backup_$timestamp"

# Ensure backup directory exists
if (!(Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
}

Write-Host "Creating backup at:"
Write-Host $backupPath

Copy-Item `
    -Path $sourcePath `
    -Destination $backupPath `
    -Recurse `
    -Force `
    -Exclude node_modules,.next,.git

Write-Host "✅ Backup completed successfully."