Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SourcePath = "C:\TorqueEmpire\ai_pro_crm_clean"
$BackupRoot = "E:\TorqueEmpire\01_CRM\Backups"
$DateStamp = Get-Date -Format "yyyy_MM_dd"
$DestinationPath = Join-Path -Path $BackupRoot -ChildPath "CRM_Backup_$DateStamp"
$ReportPath = Join-Path -Path $DestinationPath -ChildPath "backup-report.txt"

$filesCopied = 0
$success = $false
$failureMessage = ""

try {
    New-Item -Path $DestinationPath -ItemType Directory -Force | Out-Null

    $sourceRoot = (Resolve-Path -LiteralPath $SourcePath).Path
    $excludedRelativePrefixes = @(
        "node_modules\",
        ".next\",
        ".git\objects\"
    )

    $files = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -Force | Where-Object {
        $relativePath = $_.FullName.Substring($sourceRoot.Length).TrimStart("\")
        foreach ($prefix in $excludedRelativePrefixes) {
            if ($relativePath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $false
            }
        }
        return $true
    }

    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($sourceRoot.Length).TrimStart("\")
        $targetPath = Join-Path -Path $DestinationPath -ChildPath $relativePath
        $targetDirectory = Split-Path -Path $targetPath -Parent

        if (-not (Test-Path -LiteralPath $targetDirectory)) {
            New-Item -Path $targetDirectory -ItemType Directory -Force | Out-Null
        }

        Copy-Item -LiteralPath $file.FullName -Destination $targetPath -Force
        $filesCopied++
    }

    $success = $true
}
catch {
    $failureMessage = $_.Exception.Message
}
finally {
    $status = if ($success) { "Success" } else { "Failure" }
    $report = @(
        "TorqueEmpire CRM Backup Report",
        "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
        "",
        "Files copied: $filesCopied",
        "Source path: $SourcePath",
        "Destination path: $DestinationPath",
        "Status: $status"
    )

    if (-not $success -and $failureMessage) {
        $report += "Failure reason: $failureMessage"
    }

    if (-not (Test-Path -LiteralPath $DestinationPath)) {
        New-Item -Path $DestinationPath -ItemType Directory -Force | Out-Null
    }

    $report | Set-Content -Path $ReportPath -Encoding UTF8
    Write-Output ($report -join [Environment]::NewLine)
}

if (-not $success) {
    exit 1
}
