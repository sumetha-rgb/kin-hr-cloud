# HR Cloud

ระบบบริหารงานบุคคลบนเว็บ (Next.js 16 + TypeScript + Neon Postgres) ลงเวลาด้วย**ลายนิ้วมือบนมือถือ** (WebAuthn/Passkey) พร้อมตรวจพิกัด GPS

| โมดูล | เมนู | ทำอะไรได้ |
|---|---|---|
| Organization | `/organization` | สาขา + พิกัด/รัศมีลงเวลา, แผนก, ตำแหน่ง, กะงาน (รองรับกะข้ามวัน), วันหยุด, ประเภทการลา, ตั้งค่าประกันสังคม |
| Personnel | `/personnel` | ข้อมูลพนักงาน, เงินเดือน, หัวหน้างาน, บัญชีผู้ใช้/สิทธิ์, รีเซ็ตอุปกรณ์สแกนนิ้ว |
| Time Attendance | `/checkin`, `/attendance` | สแกนนิ้วเข้า-ออก, สรุปรายวัน, ปฏิทินรายเดือน, log พร้อมแผนที่, HR บันทึกแทน |
| Approve Center | `/requests` | ใบลา (ตรวจโควตา/วันซ้อน), ขอ OT, ขอแก้เวลา, อนุมัติโดยหัวหน้าหรือ HR |
| Payroll | `/payroll` | คำนวณจาก ขาด/สาย/ลา/OT, ประกันสังคม, ภาษีหัก ณ ที่จ่าย, ปิดงวด, สลิป |
| Report | `/reports` | CSV (เปิด Excel ได้): เวลาทำงาน, เงินเดือน, ไฟล์โอนธนาคาร, ประกันสังคม, การลา |

## เริ่มใช้งานบนเครื่อง

```bash
npm install
npm run db:migrate   # สร้างตาราง (ใช้ DATABASE_URL ใน .env.local)
npm run db:seed      # ข้อมูลตั้งต้น + สร้าง admin (แสดงรหัสผ่านครั้งเดียว)
npm run dev          # http://localhost:3000
```

### ข้อมูลจำลอง (สำหรับทดลอง)

```bash
npm run db:demo            # พนักงานสมมติ 32 คน 4 สาขา KIN · ลงเวลาตั้งแต่ ก.ย. 2569 · ใบลา/OT · เงินเดือน 3 งวด
npm run db:reset -- --yes  # ล้างข้อมูลทั้งหมดกลับเป็นระบบว่าง (เหลือ admin)
```
บัญชีจำลอง: username = รหัสพนักงาน (`e0002` HR · `e0013` หัวหน้าพยาบาล · `e0014` พนักงาน) · password `Demo@1234`
พิกัดสาขาสุขุมวิท 107 / ราชพฤกษ์ / พัทยา ในข้อมูลจำลองเป็นค่าประมาณ — ก่อนใช้จริงให้ไปที่สาขาแล้วกด "ใช้ตำแหน่งปัจจุบัน"

### ธีม
สีแบรนด์ KIN อยู่ใน `src/app/globals.css` (`--color-brand-*`) · โลโก้ `public/kin-logo.png` (จาก kinrehab.com) · ฟอนต์ Prompt

### ทดสอบสแกนนิ้วบนมือถือจริง
WebAuthn ทำงานได้เฉพาะ **HTTPS** (ยกเว้น localhost) ให้เปิด tunnel เช่น
`npx cloudflared tunnel --url http://localhost:3000` แล้วเปิดลิงก์ https บนมือถือ
(ระบบจะใช้โดเมนของ tunnel เป็น RP ID อัตโนมัติเมื่อปล่อย `WEBAUTHN_RP_ID` ว่างไว้)

## Deploy ขึ้น Vercel

1. push โค้ดขึ้น GitHub (`.env.local` ถูก ignore ไว้แล้ว)
2. Vercel → New Project → import repo
3. ตั้ง Environment Variables:
   - `DATABASE_URL` (Neon pooled connection string)
   - `AUTH_SECRET` (สุ่มใหม่สำหรับ production)
   - `WEBAUTHN_RP_ID` = โดเมนจริง เช่น `hr.yourcompany.com`
   - `APP_ORIGIN` = `https://hr.yourcompany.com`
4. Deploy — migration รันจากเครื่องด้วย `npm run db:migrate` (หรือเพิ่มใน CI)

> ⚠️ ลายนิ้วมือที่ลงทะเบียนผูกกับโดเมน — ถ้าเปลี่ยนโดเมนภายหลัง พนักงานต้องลงทะเบียนใหม่ จึงควรใช้โดเมนจริงตั้งแต่แรก

## การทำงานของสแกนนิ้ว

1. พนักงานเข้าสู่ระบบบนมือถือของตัวเอง → “ลงทะเบียนมือถือเครื่องนี้” (1 คน 1 เครื่อง, เปลี่ยนเครื่องต้องให้ HR รีเซ็ต)
2. ทุกครั้งที่ลงเวลา: อ่าน GPS → สแกนนิ้ว (user verification = required) → เซิร์ฟเวอร์ตรวจลายเซ็น + ระยะห่างจากสาขา
3. เซิร์ฟเวอร์เก็บแค่ **public key** — ข้อมูลลายนิ้วมือไม่ออกจากมือถือ (ลดภาระ PDPA ข้อมูลชีวภาพ แต่ยังควรมีหนังสือแจ้ง/ขอความยินยอม)

ข้อจำกัดที่ควรรู้: แอปปลอม GPS บน Android หลอกพิกัดได้ — ถ้าต้องการเข้มขึ้น ให้เพิ่มถ่ายเซลฟี่ หรือจำกัด IP/Wi-Fi ของสาขา

## โครงสร้าง

```
src/db/schema.ts           ตารางทั้งหมด (Drizzle)
src/lib/attendance.ts      สรุปเวลารายวัน (สาย, ขาด, กะข้ามวัน, วันลา)
src/lib/payroll.ts         สูตรเงินเดือน / ประกันสังคม / ภาษี (decimal.js)
src/lib/payroll-run.ts     คำนวณทั้งงวดจากฐานข้อมูล
src/app/api/webauthn/*     ลงทะเบียนลายนิ้วมือ
src/app/api/attendance/*   สแกนนิ้วลงเวลา + geofence
src/app/(app)/*            หน้าจอทุกโมดูล
```

เวลาในระบบคิดเป็นเวลาไทย (Asia/Bangkok) ทั้งหมด แม้ Vercel จะรันเป็น UTC
