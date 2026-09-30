## What

<!-- PR นี้ทำอะไร (1-3 บรรทัด) -->

## Why

<!-- ทำไมต้องทำ / แก้ปัญหาอะไร — อ้าง issue ถ้ามี เช่น Closes #12 -->

## How

<!-- วิธีที่เลือกและทางเลือกอื่นที่พิจารณาแล้ว (ถ้ามี) -->

## How to test

<!-- คำสั่งหรือขั้นตอนที่ reviewer ทำตามได้ -->

```bash

```

## Checklist

- [ ] PR title เป็น Conventional Commits (เช่น `feat(transactions): add CSV export`)
- [ ] `npm run lint`, `npm run format:check`, `npm run typecheck` ผ่าน
- [ ] เพิ่ม/แก้ test แล้ว และ `npm test` ผ่าน
- [ ] ทุก query กรองด้วย `user_id` และมี test ว่าผู้ใช้อื่นเข้าถึงไม่ได้ (ถ้าแตะ data)
- [ ] เงินใช้ `Prisma.Decimal` / string ไม่ใช้ `number`
- [ ] ไม่มี secret, password หรือ token ใน code หรือ log
- [ ] migration เป็นแบบ backward compatible (ถ้ามี)
- [ ] อัปเดต `docs/` แล้ว (ถ้าเปลี่ยน API หรือ schema)

## Screenshots

<!-- สำหรับงาน frontend -->
