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
npm run lint
npm run format:check
npm run typecheck
```

## Scripts (root)

| Script                            | ทำอะไร                            |
| --------------------------------- | --------------------------------- |
| `npm run lint` / `lint:fix`       | ESLint (type-aware) ทั้ง monorepo |
| `npm run format` / `format:check` | Prettier                          |
| `npm run typecheck`               | `tsc --noEmit` ทุก workspace      |
| `npm run build`                   | build ทุก workspace               |
| `npm test`                        | test ทุก workspace                |
