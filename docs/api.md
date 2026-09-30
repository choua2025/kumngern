# API Specification — Income & Expenses

Base URL: `/api/v1` · Content-Type: `application/json` (ยกเว้น upload และ export)
ดูเหตุผลการออกแบบใน [design-doc.md](./design-doc.md)

---

## 1. Conventions

### 1.1 Authentication

- ทุก endpoint ต้องมี `Authorization: Bearer <accessToken>` ยกเว้นที่ระบุว่า **public**
- Access token: JWT HS256, อายุ 15 นาที, payload `{ sub: "<userId>", iat, exp }`
- Refresh token: opaque string ใน cookie

| Cookie | ค่า                                                                                 |
| ------ | ----------------------------------------------------------------------------------- |
| Name   | `rt`                                                                                |
| Flags  | `HttpOnly; Secure (production); SameSite=Strict; Path=/api/v1/auth; Max-Age=604800` |

### 1.2 Response envelope

```json
// success (single)
{ "data": { } }

// success (list + pagination)
{ "data": [ ], "meta": { "page": 1, "limit": 20, "total": 134 } }

// error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลไม่ถูกต้อง",
    "details": [ { "path": "amount", "message": "ต้องมากกว่า 0" } ],
    "requestId": "b1f7c1e2-..."
  }
}
```

`204 No Content` ไม่มี body

### 1.3 Error codes

| HTTP | code               | เมื่อไร                                                                                         |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR` | Zod ไม่ผ่าน, ไฟล์ผิดประเภท/ใหญ่เกิน, กฎทางธุรกิจที่เป็นเรื่อง input (เช่น category type ไม่ตรง) |
| 401  | `UNAUTHORIZED`     | ไม่มี/หมดอายุ/token ผิด, login ผิด                                                              |
| 403  | `FORBIDDEN`        | แก้/ลบหมวดของระบบ                                                                               |
| 404  | `NOT_FOUND`        | ไม่มี **หรือเป็นของผู้ใช้อื่น**                                                                 |
| 409  | `CONFLICT`         | ซ้ำ (email, ชื่อ wallet/tag, budget), ลบสิ่งที่ถูกใช้อยู่, wallet archived, ไฟล์แนบเกิน 3       |
| 429  | `RATE_LIMITED`     | เกิน rate limit (มี header `Retry-After`)                                                       |
| 500  | `INTERNAL_ERROR`   | ข้อผิดพลาดที่ไม่คาดคิด (ไม่ส่ง stack trace ให้ client)                                          |

### 1.4 Data types

| Type      | รูปแบบ                                                          | ตัวอย่าง                     |
| --------- | --------------------------------------------------------------- | ---------------------------- |
| ID        | string ของตัวเลข                                                | `"42"`                       |
| Money     | string, ทศนิยมไม่เกิน 2 ตำแหน่ง, regex `^\d{1,16}(\.\d{1,2})?$` | `"1250.50"`                  |
| Timestamp | ISO 8601 (response เป็น UTC `Z` เสมอ, request ต้องมี offset)    | `"2026-09-15T05:30:00.000Z"` |
| Date      | `YYYY-MM-DD` ตีความตาม `users.timezone`                         | `"2026-09-01"`               |
| Month     | `YYYY-MM`                                                       | `"2026-09"`                  |
| Percent   | number ทศนิยม 1 ตำแหน่ง (ไม่ใช่เงินจึงใช้ number ได้)           | `85.3`                       |

### 1.5 Rate limits

| ขอบเขต             | ค่า                   |
| ------------------ | --------------------- |
| `POST /auth/login` | 5 ครั้ง / นาที / IP   |
| API ทั้งหมด        | 300 ครั้ง / นาที / IP |

---

## 2. Health (public)

### `GET /health`

Liveness: process ยังทำงาน (ไม่แตะ DB)

```json
200 { "data": { "status": "ok", "uptime": 1234.5 } }
```

### `GET /ready`

Readiness: `SELECT 1` ผ่าน

```json
200 { "data": { "status": "ok" } }
503 { "error": { "code": "INTERNAL_ERROR", "message": "Database unavailable" } }
```

---

## 3. Auth

### `POST /auth/register` — public

```json
// request
{
  "email": "Somchai@Example.com",
  "password": "Password123!",
  "displayName": "สมชาย",
  "defaultCurrency": "THB"
}
```

- `email` แปลงเป็นตัวพิมพ์เล็ก + trim ก่อนบันทึก
- `password` ≥ 8 ตัว, มีตัวอักษรอย่างน้อย 1 และตัวเลขอย่างน้อย 1, ≤ 72 bytes (ข้อจำกัดของ bcrypt)
- `displayName` 1–100 ตัว · `defaultCurrency` ต้องมีในตาราง currencies

```json
// 201 + Set-Cookie: rt=...
{ "data": { "user": {/* User */}, "accessToken": "eyJ..." } }
```

Errors: `400`, `409` (email ซ้ำ)

**User object**

```json
{
  "id": "1",
  "email": "somchai@example.com",
  "displayName": "สมชาย",
  "defaultCurrency": "THB",
  "timezone": "Asia/Bangkok",
  "createdAt": "2026-09-30T08:00:00.000Z"
}
```

> 💡 **Interview note — bcrypt ตัดที่ 72 bytes:** ภาษาไทย 1 ตัวอักษรใช้ 3 bytes ใน UTF-8 ถ้าไม่จำกัด รหัสผ่านไทยยาว 30 ตัว (90 bytes) ส่วนที่เกินจะถูกตัดทิ้งเงียบๆ

### `POST /auth/login` — public, rate limited

```json
// request
{ "email": "demo1@example.com", "password": "Password123!" }

// 200 + Set-Cookie: rt=...
{ "data": { "user": { /* User */ }, "accessToken": "eyJ..." } }
```

Errors: `400`, `401` ("อีเมลหรือรหัสผ่านไม่ถูกต้อง", ข้อความเดียวกันทั้งสองกรณี), `429`

### `POST /auth/refresh` — public (ใช้ cookie `rt`)

- ไม่มี body
- ทำ rotation: revoke token เดิม + ออก token ใหม่ ใน DB transaction เดียว
- ถ้า token ที่ส่งมาถูก revoke ไปแล้ว → revoke token ทั้งหมดของ user (reuse detection)

```json
// 200 + Set-Cookie: rt=<new>
{ "data": { "accessToken": "eyJ..." } }
```

Errors: `401` (ไม่มี cookie / ไม่พบ / หมดอายุ / ถูก revoke) พร้อม clear cookie

### `POST /auth/logout`

- ลบ refresh token ของ cookie นี้ออกจาก DB (ถ้ามี) + clear cookie
- ทำงานได้แม้ access token หมดอายุ (idempotent) เพื่อให้ logout ได้เสมอ

```
204
```

### `GET /auth/me`

```json
200 { "data": { /* User */ } }
```

---

## 4. Users

### `PATCH /users/me`

```json
// request (ทุก field optional แต่ต้องมีอย่างน้อย 1)
{ "displayName": "สมชาย ใจดี", "defaultCurrency": "USD", "timezone": "Asia/Vientiane" }
```

- `timezone` ต้องเป็น IANA timezone ที่ถูกต้อง (ตรวจด้วย `Intl.DateTimeFormat`)

```json
200 { "data": { /* User */ } }
```

### `PATCH /users/me/password`

```json
// request
{ "currentPassword": "Password123!", "newPassword": "NewPassw0rd!" }

// 200 + Set-Cookie: rt=<new>
{ "data": { "accessToken": "eyJ..." } }
```

- revoke refresh token **ทั้งหมด** แล้วออก token ใหม่ให้ device นี้ (X6)
- ลบ refresh token ทั้งหมดของ user (ทุกอุปกรณ์) แล้วออกชุดใหม่ให้อุปกรณ์นี้

Errors: `400` (รวมถึง `currentPassword` ผิด → `details[0].path = "currentPassword"`)

> ทำไม currentPassword ผิดถึงตอบ **400 ไม่ใช่ 401**: axios interceptor ฝั่งเว็บตีความ 401 ว่า "access token หมดอายุ" แล้วจะ refresh + retry ซึ่งจะพาผู้ใช้หลุดออกจากระบบทั้งที่แค่พิมพ์รหัสผิด

---

## 5. Currencies

### `GET /currencies` — public

ไม่ต้อง login เพราะฟอร์มสมัครสมาชิกต้องแสดงรายการสกุลเงินก่อนมีบัญชี

```json
200 {
  "data": [
    { "code": "LAK", "name": "Lao Kip", "symbol": "₭", "decimals": 0 },
    { "code": "THB", "name": "Thai Baht", "symbol": "฿", "decimals": 2 },
    { "code": "USD", "name": "US Dollar", "symbol": "$", "decimals": 2 }
  ]
}
```

---

## 6. Wallets

**Wallet object**

```json
{
  "id": "1",
  "name": "กสิกร ออมทรัพย์",
  "type": "bank",
  "currencyCode": "THB",
  "initialBalance": "1000.00",
  "balance": "1300.00",
  "isArchived": false,
  "createdAt": "2026-07-01T03:00:00.000Z"
}
```

### `GET /wallets?includeArchived=false`

```json
200 { "data": [ /* Wallet */ ] }
```

เรียงตาม `created_at ASC` · ไม่ paginate (จำนวนน้อย)

### `POST /wallets`

```json
{ "name": "เงินสด", "type": "cash", "currencyCode": "THB", "initialBalance": "500.00" }
```

`initialBalance` optional (default `"0"`) ติดลบได้ (เช่นบัตรเครดิตที่มียอดค้าง)

```json
201 { "data": { /* Wallet */ } }
```

Errors: `400`, `409` (ชื่อซ้ำ)

### `GET /wallets/:id`

```json
200 { "data": { /* Wallet */ } }
```

Errors: `404`

### `PATCH /wallets/:id`

```json
{ "name": "เงินสดในกระเป๋า", "type": "cash", "isArchived": true }
```

Errors: `400`, `404`, `409` (ชื่อซ้ำ)

### `DELETE /wallets/:id`

```
204
```

Errors: `404`, `409` ("กระเป๋านี้มีรายการแล้ว กรุณาใช้การ archive แทน") ซึ่งนับรวมรายการที่ soft delete และ recurring ที่อ้างถึง

---

## 7. Categories

**Category object**

```json
{
  "id": "5",
  "name": "อาหาร",
  "type": "expense",
  "icon": "utensils",
  "color": "#F97316",
  "parentId": null,
  "isSystem": true,
  "children": [
    {
      "id": "6",
      "name": "กาแฟ",
      "type": "expense",
      "icon": "coffee",
      "color": "#92400E",
      "parentId": "5",
      "isSystem": true,
      "children": []
    }
  ]
}
```

### `GET /categories?type=expense`

- คืนหมวดของระบบ + หมวดของผู้ใช้ เป็นต้นไม้ (root → children)
- `type` optional

```json
200 { "data": [ /* Category (root) */ ] }
```

### `POST /categories`

```json
{ "name": "ชานมไข่มุก", "type": "expense", "parentId": "5", "icon": "cup", "color": "#A855F7" }
```

กฎ:

- `parentId` ต้องเป็นหมวดของระบบหรือของผู้ใช้ (ไม่งั้น `404`)
- parent ต้องเป็น root (ไม่มี parent) → ถ้าไม่ใช่ `400` ("หมวดย่อยลึกได้ 1 ระดับ")
- `type` ต้องตรงกับ parent → `400`

```json
201 { "data": { /* Category */ } }
```

### `PATCH /categories/:id`

```json
{ "name": "ชานม", "icon": "cup", "color": "#A855F7", "parentId": null }
```

- แก้ `type` ไม่ได้ (รายการที่ใช้หมวดนี้จะผิดกฎข้อ 2)
- ย้ายหมวดที่มีลูกไปเป็นลูกของหมวดอื่นไม่ได้ → `400`
  Errors: `400`, `403` (หมวดระบบ), `404`

### `DELETE /categories/:id`

```
204
```

Errors: `403` (หมวดระบบ), `404`, `409` (มี transaction, budget, recurring หรือหมวดลูกอ้างถึง)

---

## 8. Transactions

**Transaction object**

```json
{
  "id": "101",
  "type": "transfer",
  "amount": "3500.00",
  "toAmount": "100.00",
  "note": "แลกเงินไปเที่ยว",
  "occurredAt": "2026-09-15T05:30:00.000Z",
  "wallet": { "id": "1", "name": "กสิกร ออมทรัพย์", "currencyCode": "THB" },
  "toWallet": { "id": "3", "name": "USD Cash", "currencyCode": "USD" },
  "category": null,
  "tags": [{ "id": "2", "name": "ทริปญี่ปุ่น" }],
  "recurringId": null,
  "attachmentCount": 1,
  "createdAt": "2026-09-15T05:31:10.000Z",
  "updatedAt": "2026-09-15T05:31:10.000Z",
  "deletedAt": null
}
```

`category` เมื่อไม่เป็น null: `{ "id", "name", "icon", "color", "parentId" }`

### `GET /transactions`

| Query         | Type                                                       | Default           | หมายเหตุ                                           |
| ------------- | ---------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| `from` / `to` | Date                                                       | –                 | รวมทั้งสองวัน (inclusive) ตาม timezone ผู้ใช้      |
| `type`        | `income\|expense\|transfer`                                | –                 |                                                    |
| `walletId`    | ID                                                         | –                 | ตรงกับ `wallet_id` **หรือ** `to_wallet_id`         |
| `categoryId`  | ID                                                         | –                 | รวมหมวดย่อยด้วย (X7)                               |
| `tagId`       | ID                                                         | –                 |                                                    |
| `q`           | string ≤ 100                                               | –                 | ค้นใน `note` แบบ case-insensitive (escape `%` `_`) |
| `deleted`     | boolean                                                    | `false`           | `true` = ดูเฉพาะรายการที่ลบแล้ว (X3)               |
| `page`        | int ≥ 1                                                    | 1                 |                                                    |
| `limit`       | int 1–100                                                  | 20                |                                                    |
| `sort`        | `occurredAt:desc\|occurredAt:asc\|amount:desc\|amount:asc` | `occurredAt:desc` | tie-breaker `transaction_id` เสมอ                  |

```json
200 { "data": [ /* Transaction */ ], "meta": { "page": 1, "limit": 20, "total": 134 } }
```

ถ้า `walletId`/`categoryId`/`tagId` ไม่ใช่ของผู้ใช้ → คืน list ว่าง (ไม่ใช่ 404 เพราะเป็น filter)

> 💡 **Interview note:** `q=100%` ถ้าไม่ escape `%` จะกลายเป็น wildcard ที่ match ทุกอย่าง ไม่ใช่ security hole แต่เป็น bug ที่เจอบ่อย

### `POST /transactions`

Body เป็น **discriminated union** ตาม `type`:

```json
// income / expense
{
  "type": "expense",
  "walletId": "1",
  "categoryId": "6",
  "amount": "65.00",
  "note": "Americano",
  "occurredAt": "2026-09-30T08:15:00+07:00",
  "tagIds": ["2"]
}

// transfer
{
  "type": "transfer",
  "walletId": "1",
  "toWalletId": "3",
  "amount": "3500.00",
  "toAmount": "100.00",
  "occurredAt": "2026-09-15T12:30:00+07:00"
}
```

กฎ (ลำดับการตรวจ):

1. Zod: shape ตาม type, amount > 0, `walletId ≠ toWalletId`, `tagIds` ≤ 10 ตัวและไม่ซ้ำ
2. wallet / toWallet / category / tags ต้องเป็นของผู้ใช้ (category อาจเป็นของระบบ) → `404`
3. wallet หรือ toWallet archived → `409`
4. `category.type ≠ type` → `400`
5. transfer ข้ามสกุลแต่ไม่มี `toAmount` หรือสกุลเดียวกันแต่ส่ง `toAmount` → `400`
6. INSERT transaction + transaction_tags ใน `$transaction` เดียว

```json
201 { "data": { /* Transaction */ } }
```

### `GET /transactions/:id`

เหมือน Transaction object แต่แทน `attachmentCount` ด้วย `attachments`

```json
"attachments": [
  { "id": "7", "originalName": "receipt.jpg", "mimeType": "image/jpeg", "sizeBytes": 245120, "uploadedAt": "2026-09-30T08:16:00.000Z" }
]
```

Errors: `404` (รวมถึงรายการที่ soft delete แล้ว)

### `PATCH /transactions/:id`

- ส่งเฉพาะ field ที่จะแก้ แต่ service จะ **merge กับค่าเดิมแล้วตรวจกฎทั้งชุดใหม่** (เช่นเปลี่ยน type จาก expense เป็น transfer ต้องส่ง `toWalletId` และ `categoryId: null`)
- `tagIds` ถ้าส่งมา = แทนที่ tag ทั้งหมด (ลบของเดิม + ใส่ใหม่ ใน `$transaction`)
- ย้ายไป wallet ที่ archived ไม่ได้ → `409`

```json
200 { "data": { /* Transaction */ } }
```

### `DELETE /transactions/:id`

Soft delete (`deleted_at = now()`)

```
204
```

### `POST /transactions/:id/restore`

- หาเฉพาะรายการที่ถูกลบแล้ว (ไม่เจอ → `404`)
- wallet ที่เกี่ยวข้อง archived → `409`

```json
200 { "data": { /* Transaction */ } }
```

### `GET /transactions/export.csv`

- Query เหมือน `GET /transactions` แต่ไม่มี `page`/`limit` (export ทั้งหมด สูงสุด 50,000 แถว)
- Response: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="transactions-2026-09-30.csv"`
- เริ่มไฟล์ด้วย BOM (`U+FEFF`, bytes `EF BB BF`) เพื่อให้ Excel อ่านภาษาไทยถูก
- คอลัมน์: `date, time, type, wallet, to_wallet, category, parent_category, amount, to_amount, currency, note, tags`
- วันเวลาแสดงตาม timezone ของผู้ใช้
- ป้องกัน **CSV injection**: ถ้า cell ขึ้นต้นด้วย `= + - @` ให้เติม `'` ข้างหน้า (ยกเว้นคอลัมน์ตัวเลข)

> 💡 **Interview note:** route `/transactions/export.csv` ต้องลงทะเบียน **ก่อน** `/transactions/:id` ไม่งั้น Express จะ match `:id = "export.csv"` → 400/404

---

## 9. Budgets

> ยอด `spent` นับเฉพาะรายการ `expense` ที่ไม่ถูกลบ ใน wallet สกุล `default_currency` (D7) ในเดือนนั้นตาม timezone ผู้ใช้ และถ้าเป็นหมวดแม่ **รวมหมวดย่อยด้วย**

**Budget object**

```json
{
  "id": "3",
  "month": "2026-09",
  "category": {
    "id": "5",
    "name": "อาหาร",
    "icon": "utensils",
    "color": "#F97316",
    "parentId": null
  },
  "limitAmount": "6000.00",
  "alertPercent": 80,
  "spent": "5120.00",
  "remaining": "880.00",
  "usedPercent": 85.3,
  "status": "warning",
  "currencyCode": "THB"
}
```

| status    | เงื่อนไข                           |
| --------- | ---------------------------------- |
| `ok`      | `usedPercent < alertPercent`       |
| `warning` | `alertPercent ≤ usedPercent ≤ 100` |
| `over`    | `usedPercent > 100`                |

`remaining` ติดลบได้เมื่อเกินงบ

### `GET /budgets?month=2026-09`

`month` บังคับ

```json
200 { "data": [ /* Budget */ ] }
```

### `POST /budgets`

```json
{ "categoryId": "5", "month": "2026-09", "limitAmount": "6000.00", "alertPercent": 80 }
```

- category ต้องเป็น `expense` → `400` · ไม่ใช่ของผู้ใช้/ระบบ → `404` · ซ้ำ → `409`

```json
201 { "data": { /* Budget */ } }
```

### `POST /budgets/copy`

```json
{ "toMonth": "2026-10" }
```

คัดลอกงบทั้งหมดจากเดือนก่อนหน้า `toMonth` หมวดที่มีงบอยู่แล้วจะข้าม (ไม่ทับ)

```json
200 { "data": { "copied": 3, "skipped": 1 } }
```

### `PATCH /budgets/:id`

```json
{ "limitAmount": "7000.00", "alertPercent": 90 }
```

```json
200 { "data": { /* Budget */ } }
```

### `DELETE /budgets/:id`

```
204
```

---

## 10. Reports

ทุก endpoint นับเฉพาะรายการใน wallet สกุล `default_currency` ของผู้ใช้ (design-doc D7) และไม่นับ `transfer` เป็นรายรับ/รายจ่าย

### `GET /reports/summary?month=2026-09`

```json
200 {
  "data": {
    "month": "2026-09",
    "currencyCode": "THB",
    "income": "35000.00",
    "expense": "18250.50",
    "net": "16749.50",
    "previous": { "month": "2026-08", "income": "35000.00", "expense": "20100.00", "net": "14900.00" },
    "changePercent": { "income": 0.0, "expense": -9.2, "net": 12.4 }
  }
}
```

`changePercent` = `(ปัจจุบัน − ก่อนหน้า) / |ก่อนหน้า| × 100` ถ้าเดือนก่อนเป็น 0 จะได้ `null`

### `GET /reports/by-category?from=2026-09-01&to=2026-09-30&type=expense`

`type` default `expense` · รวมยอดหมวดย่อยเข้าหมวดแม่ (root)

```json
200 {
  "data": {
    "currencyCode": "THB",
    "total": "18250.50",
    "items": [
      { "category": { "id": "5", "name": "อาหาร", "icon": "utensils", "color": "#F97316" }, "total": "7120.00", "percent": 39.0 },
      { "category": { "id": "8", "name": "เดินทาง", "icon": "bus", "color": "#0EA5E9" }, "total": "3200.00", "percent": 17.5 }
    ]
  }
}
```

เรียงตาม `total DESC`

### `GET /reports/trend?months=6`

`months` 1–24, default 6, รวมเดือนปัจจุบัน, เดือนที่ไม่มีรายการได้ `"0.00"`

```json
200 {
  "data": {
    "currencyCode": "THB",
    "items": [
      { "month": "2026-04", "income": "35000.00", "expense": "21000.00", "net": "14000.00" },
      { "month": "2026-09", "income": "35000.00", "expense": "18250.50", "net": "16749.50" }
    ]
  }
}
```

### `GET /reports/daily?month=2026-09`

รายจ่ายรายวัน ครบทุกวันของเดือน (ใช้ `generate_series` เติมวันที่ไม่มีรายการเป็น `"0.00"`)

```json
200 {
  "data": {
    "currencyCode": "THB",
    "items": [
      { "date": "2026-09-01", "expense": "245.00" },
      { "date": "2026-09-02", "expense": "0.00" }
    ]
  }
}
```

---

## 11. Tags

**Tag object**: `{ "id": "2", "name": "ทริปญี่ปุ่น" }`

| Method | Path        | Body                                         | Success                                                | Errors              |
| ------ | ----------- | -------------------------------------------- | ------------------------------------------------------ | ------------------- |
| GET    | `/tags`     | –                                            | `200 { data: Tag[] }` เรียงตามชื่อ                     |                     |
| POST   | `/tags`     | `{ "name": "ทริปญี่ปุ่น" }` (1–50 ตัว, trim) | `201`                                                  | `400`, `409`        |
| PATCH  | `/tags/:id` | `{ "name": "ญี่ปุ่น 2026" }`                 | `200`                                                  | `400`, `404`, `409` |
| DELETE | `/tags/:id` | –                                            | `204` (ลบความสัมพันธ์ใน transaction_tags ด้วย CASCADE) | `404`               |

---

## 12. Recurring

**Recurring object**

```json
{
  "id": "4",
  "type": "expense",
  "wallet": { "id": "1", "name": "กสิกร ออมทรัพย์", "currencyCode": "THB" },
  "category": {
    "id": "10",
    "name": "ที่พัก",
    "icon": "home",
    "color": "#6366F1",
    "parentId": null
  },
  "amount": "5500.00",
  "note": "ค่าเช่าห้อง",
  "frequency": "monthly",
  "nextRunDate": "2026-10-01",
  "endDate": null,
  "isActive": true
}
```

### `GET /recurring`

```json
200 { "data": [ /* Recurring */ ] }
```

### `POST /recurring`

```json
{
  "type": "expense",
  "walletId": "1",
  "categoryId": "10",
  "amount": "5500.00",
  "note": "ค่าเช่าห้อง",
  "frequency": "monthly",
  "nextRunDate": "2026-10-01",
  "endDate": null
}
```

กฎ: ownership (`404`), category type ตรง (`400`), wallet ไม่ archived (`409`), `nextRunDate` ≥ วันนี้, `endDate ≥ nextRunDate`, monthly/yearly ห้ามวันที่ 29–31 ใน MVP (`400`, D8)

```json
201 { "data": { /* Recurring */ } }
```

### `PATCH /recurring/:id`

แก้ได้ทุก field ข้างบน + `isActive` · ตรวจกฎเดียวกัน

```json
200 { "data": { /* Recurring */ } }
```

### `DELETE /recurring/:id`

```
204
```

รายการที่เคยสร้างไปแล้วยังอยู่ (`recurring_id` → NULL)

### Cron job (ไม่ใช่ endpoint)

- รันทุกวัน 00:05 (timezone ของ server จาก env `CRON_TZ`)
- `occurredAt` ของรายการที่สร้าง = `nextRunDate` เวลา 00:00 ตาม timezone ของผู้ใช้
- รายละเอียด idempotency ดู design-doc D8

---

## 13. Attachments

### `POST /transactions/:id/attachments`

- `multipart/form-data`, field name `files` (1–3 ไฟล์)
- รวมกับของเดิมแล้วต้องไม่เกิน 3 → `409`
- ไฟล์ละ ≤ 5 MB → `400`
- ตรวจชนิดจาก **magic bytes** ว่าเป็น JPEG / PNG / WEBP / PDF (ไม่เชื่อ `Content-Type` จาก client) → `400`
- เก็บที่ `/app/uploads/<userId>/<uuid>.<ext>`, ถ้า INSERT DB พลาดให้ลบไฟล์ที่เขียนไปแล้ว

```json
201 { "data": [ { "id": "7", "originalName": "receipt.jpg", "mimeType": "image/jpeg", "sizeBytes": 245120, "uploadedAt": "..." } ] }
```

Errors: `400`, `404` (transaction ไม่ใช่ของผู้ใช้หรือถูกลบ), `409`

### `GET /attachments/:id`

- ตรวจว่า attachment → transaction → `user_id` = ผู้ใช้ปัจจุบัน
- Response: stream ไฟล์ด้วย `Content-Type` จาก DB, `Content-Disposition: inline; filename*=UTF-8''<encoded>`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=0`
  Errors: `404`

> 💡 **Interview note:** `<img src="/api/v1/attachments/7">` **ใช้ไม่ได้** เพราะเบราว์เซอร์ไม่แนบ `Authorization` header ให้ และ access token อยู่ใน memory ไม่ใช่ cookie
> Frontend ต้องดึงด้วย axios (`responseType: 'blob'`) แล้วใช้ `URL.createObjectURL()` และต้อง `revokeObjectURL()` ตอน unmount เพื่อไม่ให้ memory leak

### `DELETE /attachments/:id`

ลบ record ใน DB ก่อน แล้วลบไฟล์ (ถ้าลบไฟล์พลาดให้ log warning ซึ่งไฟล์กำพร้าเก็บกวาดทีหลังได้ แต่ record ที่ชี้ไปยังไฟล์ที่ไม่มีอยู่แย่กว่า)

```
204
```

---

## 14. Endpoint summary

| Method             | Path                          | Auth                  |
| ------------------ | ----------------------------- | --------------------- |
| GET                | /health                       | public                |
| GET                | /ready                        | public                |
| POST               | /auth/register                | public                |
| POST               | /auth/login                   | public (rate limited) |
| POST               | /auth/refresh                 | cookie                |
| POST               | /auth/logout                  | cookie                |
| GET                | /auth/me                      | ✅                    |
| PATCH              | /users/me                     | ✅                    |
| PATCH              | /users/me/password            | ✅                    |
| GET                | /currencies                   | public                |
| GET, POST          | /wallets                      | ✅                    |
| GET, PATCH, DELETE | /wallets/:id                  | ✅                    |
| GET, POST          | /categories                   | ✅                    |
| PATCH, DELETE      | /categories/:id               | ✅                    |
| GET, POST          | /transactions                 | ✅                    |
| GET                | /transactions/export.csv      | ✅                    |
| GET, PATCH, DELETE | /transactions/:id             | ✅                    |
| POST               | /transactions/:id/restore     | ✅                    |
| POST               | /transactions/:id/attachments | ✅                    |
| GET, DELETE        | /attachments/:id              | ✅                    |
| GET, POST          | /budgets                      | ✅                    |
| POST               | /budgets/copy                 | ✅                    |
| PATCH, DELETE      | /budgets/:id                  | ✅                    |
| GET                | /reports/summary              | ✅                    |
| GET                | /reports/by-category          | ✅                    |
| GET                | /reports/trend                | ✅                    |
| GET                | /reports/daily                | ✅                    |
| GET, POST          | /tags                         | ✅                    |
| PATCH, DELETE      | /tags/:id                     | ✅                    |
| GET, POST          | /recurring                    | ✅                    |
| PATCH, DELETE      | /recurring/:id                | ✅                    |
