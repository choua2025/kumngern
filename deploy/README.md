# Runbook — ดูแลระบบบน server

คู่มือสำหรับคนดูแล server แต่ละหัวข้อมีคำสั่งที่ copy ไปรันได้เลย
ส่วนเรื่อง pipeline (CI/CD, GitHub Environments, rollback ผ่าน Actions) อยู่ใน [docs/cicd.md](../docs/cicd.md)

> ทุกคำสั่งรันจากโฟลเดอร์ของ environment นั้นๆ ในฐานะ user `deploy`
>
> ```bash
> cd /opt/income-expenses/production   # หรือ staging
> alias dc='docker compose -f docker-compose.prod.yml'
> ```

## 1. ไฟล์บน server

```
/opt/income-expenses/
├── staging/       (COMPOSE_PROJECT_NAME=income-expenses-staging, WEB_PORT=8081)
└── production/    (COMPOSE_PROJECT_NAME=income-expenses-production, WEB_PORT=8080)
    ├── .env                    ← secrets + image tags (chmod 600, ไม่อยู่ใน Git)
    ├── docker-compose.prod.yml ┐
    ├── deploy.sh               │ CD copy ทับให้ทุกครั้งที่ deploy
    ├── backup.sh               │ (แก้บน server ไม่ได้ ให้แก้ใน repo)
    ├── restore.sh              │
    ├── check.sh                ┘
    └── backups/                ← db-*.sql.gz + uploads-*.tar.gz (chmod 700)
```

ข้อมูลจริงอยู่ใน Docker volume 2 ตัว คือ `<project>_pgdata` (PostgreSQL) และ `<project>_uploads` (ไฟล์แนบ)
**`docker compose down -v` จะลบทั้งสองตัว ห้ามใช้บน production**

## 2. Cron

```bash
crontab -e   # ในฐานะ user deploy
```

```cron
# server ใช้เวลา UTC: 19:00 UTC = 02:00 เวลาไทย
0 19 * * *    /opt/income-expenses/production/backup.sh >> /opt/income-expenses/production/backups/backup.log 2>&1
30 19 * * *   /opt/income-expenses/staging/backup.sh    >> /opt/income-expenses/staging/backups/backup.log 2>&1
*/15 * * * *  /opt/income-expenses/production/check.sh  > /dev/null
```

- รายการประจำ (recurring) **ไม่ได้ใช้ crontab ของเครื่อง** แต่รันใน process ของ api เอง (00:05 ตาม `CRON_TZ`)
- `check.sh` เขียนปัญหาลง syslog ดูได้ด้วย `journalctl -t income-expenses --since today`

## 3. Backup

```bash
./backup.sh                 # สั่ง backup เองตอนนี้
./backup.sh before-upgrade  # ใส่ label ให้หาง่าย
ls -lh backups/
```

- ได้ไฟล์ 2 ไฟล์ต่อรอบ: `db-<UTC time>.sql.gz` (pg_dump) และ `uploads-<UTC time>.tar.gz`
- ทุกไฟล์ผ่าน `gzip -t` ก่อนเปลี่ยนชื่อจาก `.partial` ไฟล์ที่ไม่มี `.partial` จึงเป็นไฟล์ที่สมบูรณ์เสมอ
- เก็บไว้ 14 วัน (`BACKUP_RETENTION_DAYS`)
- `deploy.sh api` สั่ง backup อัตโนมัติก่อน migrate ทุกครั้ง (label `pre-deploy-<sha>`)

⚠️ **backup อยู่บน VPS เครื่องเดียวกับระบบ** ถ้า VPS พังทั้งเครื่อง backup ก็หายไปด้วย (design-doc R1)
อย่างน้อยให้ดึงไฟล์ backup ลงเครื่องตัวเองเป็นระยะ:

```bash
# รันบนเครื่องของคุณ
scp 'deploy@<server>:/opt/income-expenses/production/backups/*-$(date -u +%Y%m%d)-*.gz' ./kumngern-backups/
```

ขั้นต่อไปที่แนะนำ: ส่ง backup ขึ้น object storage อัตโนมัติ (เช่น `rclone` ไป Cloudflare R2 / Backblaze B2)

## 4. Restore

```bash
ls -t backups/db-*.sql.gz | head        # เลือกไฟล์
./restore.sh backups/db-20261001-190000.sql.gz backups/uploads-20261001-190000.tar.gz        # dry run
./restore.sh backups/db-20261001-190000.sql.gz backups/uploads-20261001-190000.tar.gz --yes  # ทำจริง
```

`restore.sh` ทำงานตามลำดับนี้

1. **backup สถานะปัจจุบันก่อน** (label `pre-restore`) ถ้ากู้ผิดไฟล์ก็ใช้ไฟล์นี้กู้กลับได้
2. หยุด api และ web (cron ของรายการประจำก็หยุดไปด้วย)
3. replay SQL ใน **transaction เดียว** ถ้าพังกลางทางจะไม่มีอะไรเปลี่ยน
4. แทนที่ไฟล์ใน volume uploads ด้วยไฟล์จาก archive (ถ้าไม่ส่ง archive มา ไฟล์เดิมจะยังอยู่)
5. เปิด api และ web แล้วรอจน api เป็น `healthy` จากนั้นแสดงจำนวนแถวหลังกู้

ระบบ **ใช้งานไม่ได้ระหว่าง restore** (ประมาณ 10–30 วินาทีสำหรับข้อมูลขนาดนี้)

### Restore drill — ทำทุก 3 เดือน และหลังเปลี่ยนวิธี backup

backup ที่ไม่เคยลองกู้ = ยังไม่รู้ว่ามี backup จริงหรือเปล่า ให้ซ้อมบน **staging** ด้วยไฟล์ของ production:

```bash
cp /opt/income-expenses/production/backups/{db,uploads}-<stamp>.*.gz /opt/income-expenses/staging/backups/
cd /opt/income-expenses/staging
./restore.sh backups/db-<stamp>.sql.gz backups/uploads-<stamp>.tar.gz --yes
# ตรวจ: จำนวนแถวตรงกับ production, login ได้, เปิดไฟล์แนบได้
```

ซ้อมครั้งแรกแล้วเมื่อ 2026-10-01 (บนเครื่อง dev ด้วย image production ตัวจริง):
ลบ user และไฟล์ทั้งหมด → restore → จำนวนแถวตรงกัน, login ได้, ยอดเงินถูก, ไฟล์แนบ 3 MB มี SHA-256 ตรงกับต้นฉบับ

## 5. Rollback

| สถานการณ์                         | ทำอย่างไร                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| deploy แล้ว health check ไม่ผ่าน  | `deploy.sh` rollback ให้เองอัตโนมัติ                                                                                |
| deploy ผ่านแล้ว แต่เจอ bug ทีหลัง | GitHub Actions → CD → Run workflow → ใส่ SHA เดิม ([cicd.md §5](../docs/cicd.md)) หรือ `./deploy.sh api <sha-เดิม>` |
| migration ทำข้อมูลเสีย            | restore จากไฟล์ `pre-deploy-<sha>` (หัวข้อ 4) แล้ว deploy SHA เดิม                                                  |

migration ที่ deploy ไปแล้ว **ไม่ถูกย้อนกลับอัตโนมัติ** เวลา rollback image จึงต้องเขียน migration แบบ expand → contract
(เพิ่มของใหม่ก่อน แล้วค่อยลบของเก่าใน release ถัดไป) เพื่อให้ image เก่ายังทำงานกับ schema ใหม่ได้

## 6. Monitoring

| ชั้น              | เครื่องมือ                                                                     | ตรวจอะไร                                                                       |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| จากภายนอก         | Uptime monitor (Better Stack / UptimeRobot แบบฟรี) ทุก 3–5 นาที                | `https://<API_DOMAIN>/api/v1/ready` และ `https://<APP_DOMAIN>/healthz` ตอบ 200 |
| บน server         | `check.sh` ทุก 15 นาที                                                         | disk < 85%, มี backup ภายใน 26 ชม., container db/api/web ทำงานและ healthy      |
| ตัวตรวจ "ตัวตรวจ" | `HEARTBEAT_URL` ใน `.env` (heartbeat check ของ Better Stack / healthchecks.io) | ถ้า `check.sh` หยุด ping (เจอปัญหา, cron ไม่ทำงาน, server ดับ) → แจ้งเตือน     |
| TLS               | Certbot renew อัตโนมัติ + uptime monitor ที่เตือนเมื่อ cert ใกล้หมดอายุ        | cert หมดอายุ                                                                   |

ตั้งค่า (ทำครั้งเดียว):

1. สร้าง monitor แบบ HTTP 2 ตัวตาม URL ด้านบน แล้วตั้งการแจ้งเตือนเป็น email หรือแอป
2. สร้าง heartbeat check ระยะ 15 นาที (ผ่อนผัน 5 นาที) แล้วใส่ URL ลงใน `.env` ของ production: `HEARTBEAT_URL=https://...`
3. ทดสอบ: `dc stop web && ./check.sh` ต้องได้ exit 1 และ heartbeat แจ้งเตือนภายใน 20 นาที จากนั้น `dc start web`

`/api/v1/health` = process ยังทำงาน (liveness) ส่วน `/api/v1/ready` = ต่อ DB ได้ และไม่ได้กำลัง shutdown (readiness) ให้ monitor ยิงตัว **ready**

## 7. คำสั่งที่ใช้บ่อย

```bash
dc ps                                    # สถานะ + health
dc logs -f --tail=100 api                # log ของ api (JSON จาก pino)
dc logs api --since 1h | grep '"level":50'    # เฉพาะ error (pino level 50)
dc logs api | grep '<requestId>'          # ไล่ request เดียวจาก requestId ที่ผู้ใช้แจ้งมา
dc exec api node dist/jobs/run-recurring.js   # สั่งรายการประจำรอบพิเศษ (ปลอดภัย ไม่สร้างซ้ำ)
dc exec db psql                          # เปิด psql (PGUSER/PGDATABASE ตั้งไว้แล้ว)
docker system df && df -h /              # พื้นที่ disk
docker image prune -a --filter 'until=168h'   # ลบ image เก่ากว่า 7 วัน
```

log ถูกจำกัดขนาดไว้ที่ 10 MB × 3 ไฟล์ต่อ container (ตั้งใน compose) จึงไม่โตจน disk เต็ม

## 8. เมื่อระบบล่ม — checklist

1. `dc ps` ดูว่า container ไหนไม่ `healthy`
2. `dc logs --tail=200 <service>` แล้วหา error บรรทัดแรก (บรรทัดหลังๆ มักเป็นผลที่ตามมา)
3. `df -h /` เพราะ disk เต็มเป็นสาเหตุอันดับหนึ่งที่ PostgreSQL หยุดรับข้อมูล
4. ถ้าเพิ่ง deploy → rollback ก่อน (หัวข้อ 5) แล้วค่อยหาสาเหตุ
5. `sudo systemctl status nginx` และ `sudo nginx -t` สำหรับปัญหา TLS / 502 จาก host nginx
6. เมื่อแก้เสร็จ จดสั้นๆ ว่าเกิดอะไร แก้อย่างไร และจะป้องกันอย่างไร
