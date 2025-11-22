# 🚀 VPS Deployment Guide - Step by Step

คู่มือการติดตั้ง Auth Service บน VPS สำหรับผู้ใช้ทั่วไป (ใช้ได้กับ VPS ทุกประเภท)

---

## ✅ สิ่งที่ต้องเตรียม

1. **VPS** (Ubuntu, Debian, CentOS, หรือ Linux distribution อื่นๆ)
2. **SSH Access** ไปยัง VPS
3. **Root หรือ Sudo access**
4. **Port 9998** ว่างอยู่

---

## 📦 Step 1: ติดตั้ง Docker บน VPS

### Ubuntu/Debian

```bash
# SSH เข้า VPS
ssh user@your-vps-ip

# อัปเดต package list
sudo apt update

# ติดตั้ง dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# เพิ่ม Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# ตั้งค่า repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# ติดตั้ง Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# เพิ่ม user ปัจจุบันเข้า docker group
sudo usermod -aG docker $USER

# Logout และ login ใหม่เพื่อให้มีผล
exit
ssh user@your-vps-ip

# ทดสอบ Docker
docker --version
docker compose version
```

### CentOS/RHEL

```bash
ssh user@your-vps-ip

sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl start docker
sudo systemctl enable docker

sudo usermod -aG docker $USER

exit
ssh user@your-vps-ip

docker --version
docker compose version
```

---

## 📤 Step 2: Upload ไฟล์ไปยัง VPS

### จาก Local Machine

```bash
# วิธีที่ 1: ใช้ SCP
cd /home/tong/Personal-Project/Aun++_Pidlok
scp -r auth-service user@your-vps-ip:/opt/

# วิธีที่ 2: ใช้ rsync (แนะนำ - เร็วกว่า)
rsync -avz --progress auth-service/ user@your-vps-ip:/opt/auth-service/

# วิธีที่ 3: ใช้ Git (ถ้ามี repository)
# บน VPS:
ssh user@your-vps-ip
cd /opt
git clone https://github.com/your-username/auth-service.git
cd auth-service
```

---

## ⚙️ Step 3: ตั้งค่า Environment Variables

```bash
ssh user@your-vps-ip
cd /opt/auth-service

# Copy production config
cp .env.production .env

# แก้ไขค่า (สำคัญมาก!)
nano .env
```

**แก้ไขไฟล์ `.env`:**

```bash
PORT=9998
NODE_ENV=production
HOST=0.0.0.0

# ⚠️ สำคัญ: เปลี่ยน ALLOWED_ORIGINS ให้ตรงกับ IP/Domain ของ Main App
# ตัวอย่าง:
ALLOWED_ORIGINS=http://123.45.67.89:9999,http://yourdomain.com

# หรือถ้าทดสอบก่อน ใช้ * (อนุญาตทุก origin)
# ALLOWED_ORIGINS=*

DB_PATH=/app/database/auth.db
```

**บันทึกไฟล์:** กด `Ctrl+X`, กด `Y`, กด `Enter`

---

## 🔥 Step 4: เปิด Firewall Port 9998

### Ubuntu/Debian (ufw)

```bash
# เปิด port 9998
sudo ufw allow 9998/tcp

# ตรวจสอบสถานะ
sudo ufw status

# ถ้า firewall ยังไม่เปิด
sudo ufw enable
```

### CentOS/RHEL (firewalld)

```bash
sudo firewall-cmd --permanent --add-port=9998/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

### DigitalOcean / AWS / GCP (Cloud Firewall)

นอกจากนี้ยังต้องเปิด port ใน Cloud Provider's Security Group/Firewall:

- **DigitalOcean:** Networking → Firewalls → Add Custom Rule → TCP 9998
- **AWS:** EC2 → Security Groups → Inbound Rules → Add Rule → TCP 9998
- **GCP:** VPC Network → Firewall → Create Firewall Rule → TCP 9998

---

## 🐳 Step 5: Build และ Start Docker Container

```bash
cd /opt/auth-service

# Build image
docker compose -f docker-compose.prod.yml build

# Start container
docker compose -f docker-compose.prod.yml up -d

# ตรวจสอบสถานะ
docker compose -f docker-compose.prod.yml ps

# ดู logs
docker compose -f docker-compose.prod.yml logs -f auth-service
```

**ผลลัพธ์ที่ต้องเห็น:**

```
🗄️  Initializing authentication database...
✅ Database initialized successfully!
📋 Tables created: passcodes, sessions, validation_logs
📍 Database location: /app/database/auth.db
═══════════════════════════════════════════════
🔐 Authentication Service
═══════════════════════════════════════════════
✅ Server running on 0.0.0.0:9998
📍 Database: /app/database/auth.db
🔒 CORS Origins: http://123.45.67.89:9999
```

**📝 หมายเหตุ:** Database จะถูกสร้างอัตโนมัติเมื่อ container start ครั้งแรก และจะไม่ถูกสร้างใหม่ทับข้อมูลเดิมเมื่อ restart

กด `Ctrl+C` เพื่อออกจาก logs

---

## 🧪 Step 6: ทดสอบการเชื่อมต่อ

### จาก VPS เอง

```bash
curl http://localhost:9998/api/health
```

### จาก Local Machine (สำคัญ!)

```bash
# จาก computer ของคุณ
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

**ถ้าไม่ได้:**
- ตรวจสอบ firewall: `sudo ufw status`
- ตรวจสอบ container: `docker compose ps`
- ดู logs: `docker compose logs -f`

---

## 🔑 Step 7: สร้าง Passcodes

```bash
cd /opt/auth-service

# เข้าไปใน container และรัน genPasscode.js
docker compose -f docker-compose.prod.yml exec auth-service node genPasscode.js

# กรอกค่า:
# Digits (default=8): 8
# Type (default=1): 1
# Passcode to create (default=50): 10
```

บันทึก passcodes ที่ได้ไว้!

---

## 🔗 Step 8: เชื่อมต่อกับ Main App

### แก้ไข Main App Config

บนเครื่อง Main App (localhost หรือ VPS อื่น):

```bash
cd /path/to/shopee-review-ALLWORK/server

# แก้ไข config.js
nano config.js
```

เปลี่ยน:

```javascript
AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://your-vps-ip:9998'
```

หรือตั้งค่าผ่าน environment variable:

```bash
export AUTH_SERVICE_URL=http://your-vps-ip:9998
node server.js
```

### ทดสอบการเชื่อมต่อ

1. เปิด Main App: `http://localhost:9999` หรือ `http://main-app-ip:9999`
2. จะถูก redirect ไปหน้า login
3. ใส่ passcode ที่สร้างไว้
4. ถ้า login สำเร็จ = ระบบทำงานถูกต้อง ✅

---

## 🔄 Auto-Start on Boot

Container จะ restart อัตโนมัติเมื่อ VPS reboot (มี `restart: unless-stopped` ใน docker-compose แล้ว)

ตรวจสอบ:

```bash
# Reboot VPS
sudo reboot

# รอ 1-2 นาที แล้ว SSH เข้ามาใหม่
ssh user@your-vps-ip

# ตรวจสอบ container
cd /opt/auth-service
docker compose -f docker-compose.prod.yml ps

# ทดสอบ
curl http://localhost:9998/api/health
```

---

## 📊 การจัดการ (Management)

### ดู Logs

```bash
cd /opt/auth-service

# Logs แบบ real-time
docker compose -f docker-compose.prod.yml logs -f

# Logs 100 บรรทัดล่าสุด
docker compose -f docker-compose.prod.yml logs --tail=100
```

### Restart Service

```bash
docker compose -f docker-compose.prod.yml restart
```

### Stop Service

```bash
docker compose -f docker-compose.prod.yml stop
```

### Start Service

```bash
docker compose -f docker-compose.prod.yml start
```

### สร้าง Passcodes เพิ่ม

```bash
docker compose -f docker-compose.prod.yml exec auth-service node genPasscode.js
```

### จัดการ Passcodes (Unbind)

```bash
docker compose -f docker-compose.prod.yml exec auth-service node managePasscode.js
```

### Backup Database

```bash
# สร้าง backup directory
mkdir -p /opt/auth-service/backups

# Backup
cp /opt/auth-service/database/auth.db /opt/auth-service/backups/auth_$(date +%Y%m%d_%H%M%S).db

# ดู backups
ls -lh /opt/auth-service/backups/
```

### Auto Backup (Cron Job)

```bash
# เปิด crontab
crontab -e

# เพิ่มบรรทัดนี้ (backup ทุกวันเวลา 2:00 AM)
0 2 * * * cp /opt/auth-service/database/auth.db /opt/auth-service/backups/auth_$(date +\%Y\%m\%d).db
```

---

## 🐛 Troubleshooting

### ปัญหา: เชื่อมต่อจาก local ไม่ได้

```bash
# 1. ตรวจสอบ container ทำงานอยู่
docker compose -f docker-compose.prod.yml ps

# 2. ตรวจสอบ firewall
sudo ufw status

# 3. ตรวจสอบ port เปิดอยู่
sudo netstat -tulpn | grep 9998

# 4. Test จาก VPS เอง
curl http://localhost:9998/api/health

# ถ้า localhost ได้แต่จาก local ไม่ได้ = firewall ปัญหา
```

### ปัญหา: CORS Error

```bash
# ตรวจสอบ ALLOWED_ORIGINS
docker compose -f docker-compose.prod.yml logs | grep "CORS Origins"

# ควรเห็น:
# 🔒 CORS Origins: http://your-main-app-ip:9999

# ถ้าไม่ถูก แก้ไข .env แล้ว restart
nano .env
docker compose -f docker-compose.prod.yml restart
```

### ปัญหา: Container ไม่ start

```bash
# ดู error
docker compose -f docker-compose.prod.yml logs

# Rebuild
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## ✅ Checklist สำหรับ Production

- [ ] Docker ติดตั้งสมบูรณ์
- [ ] ไฟล์ upload ไปยัง VPS แล้ว
- [ ] ตั้งค่า `.env` ถูกต้อง (ALLOWED_ORIGINS)
- [ ] เปิด firewall port 9998
- [ ] Container ทำงาน (`docker compose ps`)
- [ ] ทดสอบจาก local machine ได้ (`curl http://vps-ip:9998/api/health`)
- [ ] Main App เชื่อมต่อ Auth Service ได้
- [ ] สร้าง passcodes แล้ว
- [ ] ทดสอบ login ผ่าน
- [ ] ตั้งค่า auto backup database

---

## 🔒 Security Best Practices

1. **เปลี่ยน ALLOWED_ORIGINS จาก `*`** - อนุญาตเฉพาะ domain ที่ต้องการ
2. **ใช้ HTTPS** - ตั้งค่า reverse proxy (Nginx) พร้อม SSL
3. **Backup database เป็นประจำ** - ใช้ cron job
4. **Monitor logs** - ตรวจสอบ logs บ่อยๆ
5. **Update Docker image** - rebuild เป็นประจำ
6. **Limit resources** - กำหนด CPU/Memory limits (มีใน docker-compose.prod.yml แล้ว)

---

## 📞 Support

ถ้ามีปัญหา:

1. ดู logs: `docker compose -f docker-compose.prod.yml logs -f`
2. ตรวจสอบ network: `curl http://localhost:9998/api/health`
3. ตรวจสอบ firewall: `sudo ufw status`
4. ตรวจสอบ container: `docker compose ps`

---

**หมายเหตุ:** คู่มือนี้ทดสอบบน Ubuntu 22.04 แล้ว แต่ควรใช้ได้กับ Linux distribution ส่วนใหญ่

**Last Updated:** 2025-11-22
