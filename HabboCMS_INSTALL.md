# HabboCMS Production Installation Guide

This guide explains how to install and run the CMS in production using
**Nginx and Node.js on Ubuntu**.

Architecture:

Nginx │ ├── Static frontend (React/Vite build) │ └── /api → Node API
(Express via PM2)

Project structure:

habbocms/ ├── api/ │ └── Node backend ├── web/ │ └── React frontend └──
shared/

------------------------------------------------------------------------

# 1. System Requirements

Recommended environment

• Ubuntu 20.04 / 22.04\
• Nginx 1.18+\
• Node.js 18 or 20 LTS\
• MySQL / MariaDB\
• PM2

------------------------------------------------------------------------

# 2. Install Dependencies

Update the server

sudo apt update\
sudo apt upgrade -y

Install required packages

sudo apt install nginx git build-essential -y

Install Node.js (Node 20 LTS recommended)

curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash -\
sudo apt install nodejs -y

Verify installation

node -v\
npm -v

Install PM2

sudo npm install -g pm2

------------------------------------------------------------------------

# 3. Upload the CMS

Place the CMS on the server.

Example location

/var/www/habbocms

Example:

cd /var/www\
sudo git clone https://your-repo/habbocms.git\
cd habbocms

------------------------------------------------------------------------

# 4. Install Backend Dependencies

cd /var/www/habbocms/api\
npm ci

Build backend

npm run build

------------------------------------------------------------------------

# 5. Configure Backend Environment

Create

/var/www/habbocms/api/.env

Example

PORT=3001\
NODE_ENV=production

JWT_SECRET=replace_with_long_random_string\
AUTH_COOKIE_NAME=pluscms_token

CORS_ORIGIN=https://yourdomain.com

USE_HOST_COOKIE_PREFIX=true\
TRUST_PROXY=1

DB_HOST=127.0.0.1\
DB_PORT=3306\
DB_USER=your_db_user\
DB_PASS=your_db_pass\
DB_NAME=your_db_name

NITRO_URL=https://yourdomain.com/nitro/

TWOFA_ENC_KEY=replace_with_random_64_char_string

TURNSTILE_SECRET=your_turnstile_secret

------------------------------------------------------------------------

# 6. Install Frontend Dependencies

cd /var/www/habbocms/web\
npm ci

If Sass is missing

npm install -D sass-embedded

------------------------------------------------------------------------

# 7. Configure Frontend Environment

Create

/var/www/habbocms/web/.env

Example

VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key

------------------------------------------------------------------------

# 8. Build the Frontend

cd /var/www/habbocms/web\
npm run build

This generates

/var/www/habbocms/web/dist

Important

Nginx must serve the **dist** folder.

Correct

web/dist

Incorrect

web/

------------------------------------------------------------------------

# 9. Run the API with PM2

cd /var/www/habbocms/api\
pm2 start dist/index.js --name habbocms-api

Save configuration

pm2 save\
pm2 startup

Check status

pm2 status\
pm2 logs habbocms-api

API will run on

http://127.0.0.1:3001

------------------------------------------------------------------------

# 10. Configure Nginx

Create

/etc/nginx/sites-available/habbocms

Example config

server { listen 80; server_name yourdomain.com www.yourdomain.com;

    root /var/www/habbocms/web/dist;
    index index.html;

    client_max_body_size 25M;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}

Enable site

sudo ln -s /etc/nginx/sites-available/habbocms /etc/nginx/sites-enabled/

Remove default site

sudo rm /etc/nginx/sites-enabled/default

Test config

sudo nginx -t

Reload nginx

sudo systemctl reload nginx

------------------------------------------------------------------------

# 11. Install SSL

sudo apt install certbot python3-certbot-nginx -y

sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

------------------------------------------------------------------------

# 12. Static Assets

Runtime assets should go in

web/public/assets/

Example

web/public/assets/news/example.png

Database values should reference

/assets/news/example.png

------------------------------------------------------------------------

# 13. Updating the CMS

cd /var/www/habbocms/api\
npm ci\
npm run build

cd /var/www/habbocms/web\
npm ci\
npm run build

pm2 restart habbocms-api\
sudo systemctl reload nginx

------------------------------------------------------------------------

# 14. Production Checklist

• API builds successfully\
• Web build succeeds\
• Nginx serves web/dist\
• /api proxies to 127.0.0.1:3001\
• Database credentials correct\
• SSL active\
• PM2 auto-start enabled\
• Runtime assets in web/public/assets

------------------------------------------------------------------------

# 15. Useful Commands

PM2

pm2 status\
pm2 restart habbocms-api\
pm2 logs habbocms-api

Nginx

sudo nginx -t\
sudo systemctl reload nginx\
sudo systemctl restart nginx

Frontend build

npm run build

------------------------------------------------------------------------

# 16. Final Architecture

User\
│\
▼\
Nginx\
│\
├── Static files → web/dist\
│\
└── /api → Node backend (PM2)\
│\
└── MySQL database
