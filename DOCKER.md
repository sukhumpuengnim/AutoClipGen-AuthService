# 🐳 Docker Deployment Guide

คู่มือการใช้งาน Auth Service ด้วย Docker และ Docker Compose

---

## 📋 ความต้องการ (Prerequisites)

- Docker 20.10+
- Docker Compose 2.0+

ตรวจสอบเวอร์ชัน:
```bash
docker --version
docker-compose --version
```

---

## 🚀 Quick Start

### สำหรับ Local Development

```bash
cd /home/tong/Personal-Project/Aun++_Pidlok/auth-service

# Build และ start
docker-compose up -d

# ตรวจสอบ
curl http://localhost:9998/api/health
```

### สำหรับ VPS/Production (แนะนำ)

```bash
# 1. Upload ไฟล์ไปยัง VPS
scp -r auth-service user@your-vps-ip:/opt/

# 2. SSH เข้า VPS
ssh user@your-vps-ip

# 3. เข้า directory
cd /opt/auth-service

# 4. ตั้งค่า environment สำหรับ production
cp .env.production .env

# 5. แก้ไข ALLOWED_ORIGINS ให้ตรงกับ domain ของคุณ
nano .env
# เปลี่ยน ALLOWED_ORIGINS=*
# เป็น ALLOWED_ORIGINS=http://your-main-app-ip:9999

# 6. Build และ start ด้วย production config
docker-compose -f docker-compose.prod.yml up -d

# 7. ตรวจสอบ logs
docker-compose -f docker-compose.prod.yml logs -f

# 8. Test จาก local machine
curl http://your-vps-ip:9998/api/health
```

**ผลลัพธ์ที่คาดหวัง:**
```json
{
  "success": true,
  "service": "auth-service",
  "status": "healthy",
  "timestamp": "2025-11-22T..."
}
```

---

## 🗄️ Auto Database Initialization

**Database จะถูกสร้างอัตโนมัติ** เมื่อ container start:

```bash
# เมื่อ start container จะเห็น logs:
🗄️  Initializing authentication database...
✅ Database initialized successfully!
📋 Tables created: passcodes, sessions, validation_logs
```

**คุณสมบัติ:**
- ✅ **Auto-create:** Database สร้างอัตโนมัติเมื่อ start ครั้งแรก
- ✅ **Safe restart:** Restart container ไม่ทำลายข้อมูลเดิม (ใช้ `IF NOT EXISTS`)
- ✅ **Volume persistence:** ข้อมูลถูกเก็บใน `./database/` บน host
- ✅ **No manual steps:** ไม่ต้องรัน `node init-db.js` ด้วยมือ

**การทำงาน:**
```yaml
# ใน docker-compose.yml มี command:
command: sh -c "node init-db.js && node server.js"
```

ทุกครั้งที่ container start จะ:
1. รัน `node init-db.js` (สร้าง tables ถ้ายังไม่มี)
2. รัน `node server.js` (start server)

---

## ⚠️ สำคัญสำหรับ VPS Deployment

### 1. ตั้งค่า ALLOWED_ORIGINS

**ปัญหา:** ถ้าไม่ตั้งค่า ALLOWED_ORIGINS ให้ถูกต้อง main app จะเชื่อมต่อไม่ได้!

**วิธีแก้:**

แก้ไขไฟล์ `.env`:
```bash
# เปลี่ยนจาก
ALLOWED_ORIGINS=*

# เป็น (ใช้ IP หรือ domain จริง)
ALLOWED_ORIGINS=http://192.168.1.100:9999,http://your-domain.com
```

หรือตั้งค่าผ่าน docker-compose:
```bash
# ตั้งค่า environment variable
export ALLOWED_ORIGINS=http://your-vps-ip:9999

# Start container
docker-compose -f docker-compose.prod.yml up -d
```

### 2. เปิด Firewall Port

```bash
# Ubuntu/Debian
sudo ufw allow 9998
sudo ufw status

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=9998/tcp
sudo firewall-cmd --reload
```

### 3. ตรวจสอบว่า Container รับ connection จากภายนอกได้

```bash
# จาก local machine ลอง curl ไปยัง VPS
curl http://your-vps-ip:9998/api/health

# ถ้าไม่ได้ ตรวจสอบ:
# 1. Firewall บน VPS
# 2. Security Group (ถ้าใช้ Cloud Provider)
# 3. Container logs: docker-compose logs -f
```

---

## 🔧 การจัดการ Container

### Start/Stop/Restart

```bash
# Start
docker-compose start

# Stop (ไม่ลบ container)
docker-compose stop

# Restart
docker-compose restart

# Down (ลบ container แต่เก็บ volume)
docker-compose down

# Down + ลบ volume (ระวัง! จะลบ database)
docker-compose down -v
```

### ดู Logs

```bash
# ดู logs แบบ real-time
docker-compose logs -f

# ดู logs เฉพาะ auth-service
docker-compose logs -f auth-service

# ดู logs 100 บรรทัดล่าสุด
docker-compose logs --tail=100 auth-service
```

### เข้าไปใน Container

```bash
# เข้า shell ใน container
docker-compose exec auth-service sh

# รัน command ใน container
docker-compose exec auth-service node genPasscode.js
docker-compose exec auth-service node managePasscode.js
```

---

## 🔑 การจัดการ Passcodes ใน Docker

### สร้าง Passcodes

```bash
docker-compose exec auth-service node genPasscode.js
```

จะแสดง interactive prompt:
```
Digits (default=8): 8
Type (default=1): 1
Passcode to create (default=50): 50
```

### จัดการ Passcodes (Unbind/Reset)

```bash
docker-compose exec auth-service node managePasscode.js
```

เมนูตัวเลือก:
1. List all passcodes
2. View passcode details
3. Unbind/Reset passcode
4. Exit

### ตรวจสอบ Database

```bash
# เข้า container
docker-compose exec auth-service sh

# เข้า SQLite
cd database
sqlite3 auth.db

# ดู passcodes ทั้งหมด
SELECT * FROM passcodes;

# ออกจาก SQLite
.exit

# ออกจาก container
exit
```

---

## 💾 การจัดการข้อมูล (Data Persistence)

### Database Volume

Database จะถูกเก็บไว้ที่ `./database/` และ mount เข้า container ผ่าน volume:

```yaml
volumes:
  - ./database:/app/database
```

**ข้อดี:**
- ✅ ข้อมูลไม่หายเมื่อ restart container
- ✅ สามารถ backup database ได้ง่าย
- ✅ แก้ไขข้อมูลจากภายนอก container ได้

### Backup Database

```bash
# Backup
cp ./database/auth.db ./database/auth.db.backup

# หรือ backup พร้อม timestamp
cp ./database/auth.db ./database/auth_$(date +%Y%m%d_%H%M%S).db

# Restore
cp ./database/auth.db.backup ./database/auth.db
docker-compose restart
```

### Backup อัตโนมัติ (ใช้ cron)

```bash
# เปิด crontab
crontab -e

# เพิ่มบรรทัดนี้ (backup ทุกวันเวลา 2:00 AM)
0 2 * * * cp /home/tong/Personal-Project/Aun++_Pidlok/auth-service/database/auth.db /home/tong/backups/auth_$(date +\%Y\%m\%d).db
```

---

## 🌐 การ Deploy บน VPS

### 1. อัพโหลดไฟล์ไปยัง VPS

```bash
# จาก local machine
cd /home/tong/Personal-Project/Aun++_Pidlok
scp -r auth-service user@your-vps-ip:/path/to/
```

### 2. เข้า VPS และติดตั้ง Docker

```bash
ssh user@your-vps-ip

# ติดตั้ง Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# เพิ่ม user เข้า docker group
sudo usermod -aG docker $USER

# ติดตั้ง Docker Compose
sudo apt install docker-compose-plugin

# Logout และ login ใหม่
exit
ssh user@your-vps-ip
```

### 3. Start Service

```bash
cd /path/to/auth-service

# Build และ start
docker-compose up -d

# ตรวจสอบ
docker-compose ps
docker-compose logs -f
```

### 4. ตั้งค่า Firewall

```bash
# เปิด port 9998
sudo ufw allow 9998

# หรือเปิดเฉพาะ IP ของ main app
sudo ufw allow from <main-app-ip> to any port 9998

# ตรวจสอบ
sudo ufw status
```

### 5. Auto-start on Boot (PM2 Alternative)

```bash
# ตั้งค่า docker service ให้ start อัตโนมัติ
sudo systemctl enable docker

# docker-compose.yml มี restart: unless-stopped อยู่แล้ว
# Container จะ restart อัตโนมัติเมื่อระบบ reboot
```

---

## 🔒 การใช้งานกับ Reverse Proxy (Nginx)

### ติดตั้ง Nginx

```bash
sudo apt update
sudo apt install nginx
```

### ตั้งค่า Nginx

สร้างไฟล์ `/etc/nginx/sites-available/auth-service`:

```nginx
server {
    listen 80;
    server_name auth.yourdomain.com;

    location / {
        proxy_pass http://localhost:9998;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable และ Restart Nginx

```bash
sudo ln -s /etc/nginx/sites-available/auth-service /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### เพิ่ม SSL ด้วย Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d auth.yourdomain.com
```

---

## 📊 Monitoring

### Health Check

Docker Compose มี health check อัตโนมัติ:

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "..."]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s
```

ตรวจสอบ health status:

```bash
docker-compose ps
```

### ดู Resource Usage

```bash
# CPU, Memory, Network usage
docker stats auth-service

# ดูแบบ real-time
docker stats --no-stream auth-service
```

### ดู Container Logs

```bash
# Logs ทั้งหมด
docker-compose logs -f

# Logs เฉพาะ errors
docker-compose logs | grep -i error

# Export logs ไปยังไฟล์
docker-compose logs > auth-service.log
```

---

## 🔧 Troubleshooting

### ปัญหา: Container ไม่ start

```bash
# ดู logs
docker-compose logs auth-service

# ตรวจสอบ port conflict
sudo lsof -i :9998

# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### ปัญหา: Database permission denied

```bash
# แก้ไข permissions
sudo chmod -R 755 ./database
sudo chown -R $USER:$USER ./database

# Restart container
docker-compose restart
```

### ปัญหา: เชื่อมต่อจาก main app ไม่ได้

```bash
# ตรวจสอบ network
docker-compose exec auth-service ping -c 3 google.com

# ตรวจสอบ port เปิดอยู่หรือไม่
docker-compose exec auth-service netstat -tuln | grep 9998

# ตรวจสอบ firewall
sudo ufw status

# Test จาก main app
curl http://localhost:9998/api/health
```

### ปัญหา: Database หาย

```bash
# ตรวจสอบ volume
docker-compose down
ls -la ./database/

# ถ้ามี backup ให้ restore
cp ./database/auth.db.backup ./database/auth.db

# Start container ใหม่
docker-compose up -d
```

---

## 🔄 การอัปเดต

### อัปเดต Code

```bash
# Pull code ใหม่
git pull

# หรือ copy ไฟล์ใหม่จาก local
scp -r auth-service user@vps:/path/to/

# Rebuild และ restart
docker-compose down
docker-compose build
docker-compose up -d
```

### อัปเดต Dependencies

```bash
# แก้ไข package.json
nano package.json

# Rebuild image
docker-compose build --no-cache
docker-compose up -d
```

---

## 🗑️ ลบทั้งหมด (Clean Up)

```bash
# Stop และลบ container
docker-compose down

# ลบ container + volumes
docker-compose down -v

# ลบ images
docker rmi auth-service-auth-service

# ลบทุกอย่าง (ระวัง!)
docker-compose down -v --rmi all
```

---

## 📝 Environment Variables

ตั้งค่า environment variables ใน `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - PORT=9998
  - DB_PATH=/app/database/auth.db
```

หรือใช้ไฟล์ `.env`:

```bash
# สร้างไฟล์ .env
cp .env.example .env

# แก้ไขค่า
nano .env

# docker-compose จะอ่านค่าจาก .env อัตโนมัติ
docker-compose up -d
```

---

## 📞 Support

### ดู Logs เพื่อวิเคราะห์ปัญหา

```bash
# Logs ทั้งหมด
docker-compose logs -f auth-service

# Logs ย้อนหลัง 1 ชั่วโมง
docker-compose logs --since 1h auth-service

# Export logs
docker-compose logs auth-service > debug.log
```

### ตรวจสอบสถานะระบบ

```bash
# Container status
docker-compose ps

# Resource usage
docker stats auth-service

# Network
docker network ls
docker network inspect auth-service_auth-network

# Health check
curl http://localhost:9998/api/health
curl http://localhost:9998/api/stats
```

---

## 🎯 Best Practices

1. **Backup Database เป็นประจำ** - ใช้ cron job สำหรับ backup อัตโนมัติ
2. **Monitor Logs** - ตรวจสอบ logs เป็นประจำเพื่อหา error
3. **Update Security Patches** - อัปเดต base image เป็นประจำ
4. **Use HTTPS** - ใช้ reverse proxy พร้อม SSL certificate
5. **Limit Resources** - กำหนด CPU/Memory limits ใน docker-compose.yml
6. **Network Security** - ใช้ firewall และ network segmentation
7. **Version Control** - เก็บ Dockerfile และ docker-compose.yml ไว้ใน git

---

**Last Updated:** 2025-11-22
