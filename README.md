# Income & Expenses

บันทึกรายรับ-รายจ่ายจากหลายกระเป๋าเงินในที่เดียว เห็นยอดคงเหลือทุกกระเป๋า และรู้ทันทีว่าเดือนนี้ใช้เกินงบหมวดไหน

- 📐 [Design Doc](docs/design-doc.md) · 🗂️ [ERD](docs/erd.md) · 🔌 [API Spec](docs/api.md)
- 🤝 [Contributing (branch strategy, commit convention)](CONTRIBUTING.md)

## Tech stack

| Layer    | Stack                                                                    |
| -------- | ------------------------------------------------------------------------ |
| API      | Node.js 24 LTS, TypeScript 5, Express 4, Prisma, Zod, JWT                |
| Web      | React 18, Vite, Tailwind CSS, TanStack Query, React Hook Form, Recharts  |
| Database | PostgreSQL 16                                                            |
| DevOps   | Docker Compose, GitHub Actions, ghcr.io, Nginx + Certbot on Ubuntu 24.04 |

## Repository layout

```
apps/api         Express API            (Phase 2+)
apps/web         React SPA              (Phase 7+)
packages/shared  Zod schemas, constants and types shared by api and web
deploy/          Production compose, host nginx, backup script  (Phase 9+)
docs/            Design doc, ERD, API spec
```

## Getting started

Requirements: Node.js 24 (`nvm use` / `fnm use` reads `.nvmrc`), npm 11, Docker Desktop

```bash
npm install
cp .env.example .env        # then set JWT_ACCESS_SECRET (and PORT/POSTGRES_PORT if taken)
npm run db:up && npm run db:deploy && npm run db:seed

npm run dev:api             # terminal 1 — API on $PORT (default 3000)
npm run dev:web             # terminal 2 — http://localhost:5173 (proxies /api to the API)
```

Login with `demo1@example.com` / `Password123!`. Press **N** anywhere to add a transaction.

## Scripts (root)

| Script                            | ทำอะไร                            |
| --------------------------------- | --------------------------------- |
| `npm run lint` / `lint:fix`       | ESLint (type-aware) ทั้ง monorepo |
| `npm run format` / `format:check` | Prettier                          |
| `npm run typecheck`               | `tsc --noEmit` ทุก workspace      |
| `npm run build`                   | build ทุก workspace               |
| `npm test`                        | test ทุก workspace                |
| `npm run dev:api` / `dev:web`     | dev server ของ API / เว็บ         |
