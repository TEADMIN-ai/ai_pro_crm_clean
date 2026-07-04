#!/usr/bin/env bash
set -euo pipefail

echo "[1/12] Pre-flight checks"
uname -a
lsb_release -a || true
df -h
free -h
timedatectl status || true

echo "[2/12] Base packages"
sudo apt update
sudo apt install -y git curl ca-certificates build-essential nginx ufw fail2ban unzip

echo "[3/12] Node 24.x"
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

echo "[4/12] PM2"
sudo npm install -g pm2
pm2 -v

echo "[5/12] Deploy user"
if ! id deploy >/dev/null 2>&1; then
  sudo adduser --disabled-password --gecos "" deploy
  sudo usermod -aG sudo deploy
fi

echo "[6/12] Firewall"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose

echo "[7/12] Fail2ban"
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
sudo systemctl status fail2ban --no-pager || true

echo "[8/12] App directory"
sudo mkdir -p /var/www/ai_pro_crm
sudo chown -R deploy:deploy /var/www/ai_pro_crm

echo "[9/12] Git repo"
cd /var/www/ai_pro_crm
if [ ! -d .git ]; then
  git clone <REPO_URL> .
else
  git fetch --all --prune
  git checkout main
  git pull --ff-only
fi

echo "[10/12] Environment"
touch /var/www/ai_pro_crm/.env.production
chmod 600 /var/www/ai_pro_crm/.env.production
echo "Populate /var/www/ai_pro_crm/.env.production manually. Do not print secrets."

echo "[11/12] Install and build"
npm ci
npm run typecheck
npm run lint
npm test
npm run build
if npm run | grep -q "build:strict"; then
  npm run build:strict
fi

echo "[12/12] PM2 and Nginx"
pm2 start npm --name ai-pro-crm -- start
pm2 save
sudo tee /etc/nginx/sites-available/ai-pro-crm >/dev/null <<'EOF'
server {
    listen 80;
    server_name roarcarssa.com www.roarcarssa.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/ai_pro_crm /etc/nginx/sites-enabled/ai_pro_crm
sudo nginx -t
sudo systemctl reload nginx

echo "Provisioning scaffold complete. Validate via hosts-file override before DNS cutover."
