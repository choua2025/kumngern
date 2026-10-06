# Income & Expenses

บันทึกรายรับ-รายจ่ายจากหลายกระเป๋าเงินในที่เดียว เห็นยอดคงเหลือทุกกระเป๋า และรู้ทันทีว่าเดือนนี้ใช้เกินงบหมวดไหน

[![CI API](https://github.com/choua2025/kumngern/actions/workflows/ci-api.yml/badge.svg?branch=develop)](https://github.com/choua2025/kumngern/actions/workflows/ci-api.yml)
[![CI Web](https://github.com/choua2025/kumngern/actions/workflows/ci-web.yml/badge.svg?branch=develop)](https://github.com/choua2025/kumngern/actions/workflows/ci-web.yml)

| เอกสาร                              | เนื้อหา                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| 📐 [Design Doc](docs/design-doc.md) | การตัดสินใจทางเทคนิค (D1–D11), สิ่งที่ต่างจาก spec (X1–X18) |
| 🗂️ [ERD](docs/erd.md)               | ตาราง, constraints, indexes, view                           |
| 🔌 [API Spec](docs/api.md)          | ทุก endpoint, request/response, error codes                 |
| 🚀 [CI/CD](docs/cicd.md)            | pipeline แยก API/Web, staging/production, rollback          |
| 🛠️ [Runbook](deploy/README.md)      | backup, restore, monitoring, เมื่อระบบล่ม                   |
| 🤝 [Contributing](CONTRIBUTING.md)  | branch strategy, commit convention, PR                      |

## ฟีเจอร์

- **หลายกระเป๋า หลายสกุลเงิน** — เงินสด, บัญชีธนาคาร, e-wallet, บัตรเครดิต และยอดคงเหลือคำนวณจากรายการเสมอ (ไม่เก็บยอดแยกไว้)
- **รายรับ / รายจ่าย / โอน** รวมถึงโอนข้ามสกุลเงิน, ถังขยะพร้อมกู้คืน, และ Quick Add (กด **N** ที่หน้าไหนก็ได้)
- **หมวดหมู่ 2 ระดับ, แท็ก, ค้นหาและกรอง** และ export CSV ที่เปิดใน Excel ภาษาไทยได้ถูกต้อง
- **งบประมาณรายเดือน** พร้อมแถบเตือนเมื่อใช้ถึง % ที่ตั้งไว้ และคัดลอกงบจากเดือนก่อนได้
- **รายงาน** สรุปเดือน, สัดส่วนตามหมวด, แนวโน้ม 6–12 เดือน, รายจ่ายรายวัน
- **รายการประจำ** (ค่าเช่า, เงินเดือน) ที่ระบบบันทึกให้ทุกวัน เป็น idempotent และปลอดภัยเมื่อรันพร้อมกันหลาย instance
- **ไฟล์แนบ** รูปใบเสร็จ/PDF โดยตรวจชนิดไฟล์จาก magic bytes
- **3 ภาษา: ไทย, English, ລາວ** (เปลี่ยนได้ทั้งหน้า login และหน้าตั้งค่า, วันที่และตัวเลขเปลี่ยนตามภาษา)
- **Dark mode**, ใช้บนมือถือได้, และ timezone ของผู้ใช้ถูกใช้ทุกที่ที่มีคำว่า "วันนี้" หรือ "เดือนนี้"

## สถาปัตยกรรม

```mermaid
flowchart LR
  browser([Browser]) -- HTTPS --> hostnginx[Host nginx<br/>TLS · Certbot]
  hostnginx --> web[web container<br/>nginx: SPA + /api proxy]
  web -- /api --> api[api container<br/>Express · node-cron]
  api --> db[(PostgreSQL 16)]
  api --> uploads[(uploads volume)]
  subgraph backend network · internal
    db
  end
```

- **API** ใช้ router → controller → service → repository (controller ไม่เรียก Prisma ตรง), validate ทุก request ด้วย Zod, และมี error handler กลางที่เดียว
- **Auth** ใช้ access JWT อายุ 15 นาทีเก็บใน memory และ refresh token แบบ opaque ใน cookie `httpOnly` + `SameSite=Strict` ที่หมุนใหม่ทุกครั้งและตรวจจับการนำกลับมาใช้ซ้ำได้
- **เงิน** ไม่เคยเป็น JS `number` (ใช้ `Decimal(18,2)` ใน DB, string ใน API, `Prisma.Decimal` ในโค้ด)
- **ข้อมูลแยกตามผู้ใช้** ทุก query กรองด้วย `user_id` และมี test ทุก module ว่าข้อมูลของคนอื่นตอบ `404`
- `packages/shared` เก็บ Zod schemas และ types ที่ API กับ Web ใช้ร่วมกัน กฎจึงตรงกันทั้งสองฝั่ง

## Tech stack

| Layer    | Stack                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| API      | Node.js 24 LTS, TypeScript 5 (strict), Express 4, Prisma 7, Zod 4, JWT, pino, node-cron |
| Web      | React 18, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Recharts   |
| Database | PostgreSQL 16                                                                           |
| Test     | Vitest, Supertest (กับ PostgreSQL จริง), Testing Library                                |
| DevOps   | Docker Compose, GitHub Actions, ghcr.io, Nginx + Certbot บน Ubuntu 24.04                |

## Repository layout

```
apps/api         Express API + Prisma schema/migrations + recurring job
apps/web         React SPA
packages/shared  Zod schemas, constants และ types ที่ api กับ web ใช้ร่วมกัน
deploy/          compose ของ production, deploy / backup / restore / check scripts, runbook
docs/            design doc, ERD, API spec, CI/CD
```

## เริ่มต้นใช้งาน (development)

ต้องมี Node.js 24 (`nvm use` / `fnm use` อ่านจาก `.nvmrc`), npm 11 และ Docker Desktop

```bash
npm install
cp .env.example .env        # ตั้ง JWT_ACCESS_SECRET, PASSWORD_RESET_SECRET (และ PORT/POSTGRES_PORT ถ้าพอร์ตชนกับโปรแกรมอื่น)
npm run db:up && npm run db:deploy && npm run db:seed

npm run dev:api             # terminal 1 — API ที่ $PORT (ค่าเริ่มต้น 3000)
npm run dev:web             # terminal 2 — http://localhost:5173 (proxy /api ไปที่ API)
```

login ด้วย `demo1@example.com` / `Password123!` (บัญชี THB) หรือ `demo2@example.com` (LAK + USD)

### รันทั้งหมดใน Docker

```bash
cp .env.example .env        # ตั้ง JWT_ACCESS_SECRET, PASSWORD_RESET_SECRET; เปลี่ยน API_PORT/WEB_PORT/POSTGRES_PORT ถ้าชน
docker compose up --build   # db + api (hot reload) + web → http://localhost:5173
# อีเมลทั้งหมด (เช่นรหัสลืมรหัสผ่าน) ไปที่ Mailpit → http://localhost:8025
docker compose exec api npm run db:seed    # ข้อมูลตัวอย่าง (ไม่บังคับ)
```

## Test

```bash
npm run db:up               # test ใช้ฐานข้อมูล income_expenses_test (สร้างให้อัตโนมัติ) ไม่แตะ DB หลัก
npm test                    # ทุก workspace
npm run test:coverage -w apps/api
npm run reconcile -w apps/api   # เทียบตัวเลขรายงานกับการคำนวณตรงจาก SQL
```

- **API** ~190 tests เป็น integration test กับ PostgreSQL จริง ครอบคลุม data isolation, race condition (row lock), timezone และ idempotency ของ cron (coverage ~93%)
- **Web** เน้น component และ hook ที่มี logic เช่น single-flight token refresh, ตัวกรองใน URL, และสถานะ loading/empty/error ของทุกหน้า

## Deploy

| Environment | Branch    | Web                          | API                        |
| ----------- | --------- | ---------------------------- | -------------------------- |
| staging     | `develop` | https://front.dev.chdev.site | https://api.dev.chdev.site |
| production  | `main`    | (กำหนดใน Phase 14)           | (กำหนดใน Phase 14)         |

merge เข้า `develop` → build image → deploy staging อัตโนมัติ ส่วน merge เข้า `main` → deploy production หลังมีคนกด approve
deploy ทีละ app (API ก่อน Web) โดย backup DB และ migrate ก่อน แล้วตรวจ health check ถ้าไม่ผ่านจะ rollback อัตโนมัติ
รายละเอียดดู [docs/cicd.md](docs/cicd.md) และ [deploy/README.md](deploy/README.md)

| Image                     | Dockerfile target                 | ใช้ทำอะไร                                                |
| ------------------------- | --------------------------------- | -------------------------------------------------------- |
| `income-expenses-api`     | `apps/api/Dockerfile` → `runtime` | API, non-root, เฉพาะ production deps (~234 MB)           |
| `income-expenses-migrate` | `apps/api/Dockerfile` → `migrate` | `prisma migrate deploy` + reference data (และ demo seed) |
| `income-expenses-web`     | `apps/web/Dockerfile` → `runtime` | nginx: static files, SPA fallback, proxy `/api` (~68 MB) |

## Scripts (root)

| Script                              | ทำอะไร                               |
| ----------------------------------- | ------------------------------------ |
| `npm run lint` / `lint:fix`         | ESLint (type-aware) ทั้ง monorepo    |
| `npm run format` / `format:check`   | Prettier                             |
| `npm run typecheck`                 | `tsc --noEmit` ทุก workspace         |
| `npm run build`                     | build ทุก workspace                  |
| `npm test`                          | test ทุก workspace                   |
| `npm run dev:api` / `dev:web`       | dev server ของ API / เว็บ            |
| `npm run db:up` / `db:down`         | เปิด/ปิด PostgreSQL ใน Docker        |
| `npm run db:deploy` / `db:seed`     | apply migrations / ใส่ข้อมูลตัวอย่าง |
| `npm run job:recurring -w apps/api` | สั่งรันรายการประจำหนึ่งรอบ           |
