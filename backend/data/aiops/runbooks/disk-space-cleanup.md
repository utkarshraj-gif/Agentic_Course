runbook_id: RB-OS-002
services: batch-worker
risk: low

# Runbook: Disk Almost Full

## Symptoms

Disk usage above 90% on a host or volume, usually in log directories.

## Remediation

Compress or delete rotated log files older than 7 days in /var/log/batch. Confirm logrotate compression is enabled. If usage is still above 85%, expand the volume.

## Verification

Disk usage below 75% after cleanup.
