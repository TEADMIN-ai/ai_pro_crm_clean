# Production Runbook

Scope: Roar Cars SA deployment on Ubuntu 24.04 VPS `187.55.224.128` / `srv1792228.hstgr.cloud`.

The current live site remains on `191.101.232.241` until DNS cutover is explicitly approved.

## Server Baseline

- OS: Ubuntu 24.04 LTS
- Runtime: Node 24.x
- Process manager: PM2
- Reverse proxy: Nginx
- App user: `deploy`
- App port: `127.0.0.1:3000`

## Required Environment Variables

Only variable names are documented here. Do not print or commit values.

- `NODE_ENV`
- `PORT`
- `HOST`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ROAR_CARS_FINANCE_NOTIFICATION_RECIPIENTS`
- `ROAR_CARS_GENERAL_CONTACT_RECIPIENTS`
- `OPENAI_API_KEY`
- `OPENAI_DOCUMENT_MODEL`
- `OPENAI_TENDER_MODEL`
- `NEXT_PUBLIC_DOLIBARR_API_URL`

## Snapshot Requirement

Before any change:

1. Create or confirm a Hostinger VPS snapshot.
2. Record the snapshot time and identifier.
3. Do not proceed without rollback coverage.

## Deployment Process

1. Create `deploy` user and log in as that user.
2. Install base packages, Node 24.x, PM2, Nginx, UFW, and Fail2ban.
3. Clone the repository into `/var/www/ai_pro_crm`.
4. Create `/var/www/ai_pro_crm/.env.production` with `600` permissions.
5. Run validation:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run build:strict
```

6. Start the app with PM2 on localhost only.
7. Configure Nginx to proxy to `127.0.0.1:3000`.
8. Validate with a hosts-file override before DNS change.

## PM2 Commands

```bash
pm2 status
pm2 logs ai-pro-crm
pm2 restart ai-pro-crm
pm2 stop ai-pro-crm
pm2 delete ai-pro-crm
pm2 monit
pm2 save
pm2 startup systemd
```

## Nginx Config Location

- `/etc/nginx/sites-available/ai-pro-crm`
- `/etc/nginx/sites-enabled/ai-pro-crm`

Proxy target:

```nginx
proxy_pass http://127.0.0.1:3000;
```

## SSL Plan

1. Validate HTTP locally on the new VPS.
2. Keep DNS unchanged until smoke tests pass.
3. After cutover, issue or renew the public certificate.
4. Reload Nginx after certificate install.

## Hosts-File Testing

Temporarily map the domain to the new VPS on the test workstation only:

```text
187.55.224.128 roarcarssa.com
187.55.224.128 www.roarcarssa.com
```

Remove the entries after testing.

## Smoke Test Checklist

- Login succeeds.
- `/api/me` returns the expected profile.
- Roar Cars dashboard loads.
- Vehicle finance application save succeeds.
- Notification email sends through Resend.
- Failed notification creates a retry record.
- Firestore read/write works.
- File upload/storage works.
- Browser console has no errors.
- PM2 process stays online.
- Nginx logs stay clean.

## Log Locations

- PM2 stdout: `~/.pm2/logs/ai-pro-crm-out.log`
- PM2 stderr: `~/.pm2/logs/ai-pro-crm-error.log`
- Nginx access log: `/var/log/nginx/access.log`
- Nginx error log: `/var/log/nginx/error.log`

## Backup and Rollback

1. Preserve the pre-change snapshot.
2. Keep the old host at `191.101.232.241` untouched.
3. If the new VPS fails validation, stop PM2 on the new host.
4. Revert DNS only after approval.
5. Do not overwrite production data during rollback.
