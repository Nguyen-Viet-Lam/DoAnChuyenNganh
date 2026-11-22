# NovelVerse AI

Ứng dụng quản lý, dịch và biên tập tiểu thuyết Trung/Anh sang tiếng Việt với Google Gemini.

## Trạng thái hiện tại

Nhánh `feat/week-6-quality-and-library` đã hoàn thiện phạm vi tuần 6 và sửa các thiếu sót quan trọng của tuần 1–5:

- Xác thực JWT, chuẩn hóa email, kiểm tra email/mật khẩu và phân quyền dữ liệu theo chủ sở hữu.
- CRUD tiểu thuyết, chương và thuật ngữ.
- Dịch chương theo từng đoạn, lưu tiến độ, giới hạn lượt AI và dịch lại đoạn.
- Trình biên tập song ngữ dùng chương thật, auto-save tuần tự và chống ghi đè bản nháp khi dịch lại.
- QA Engine phát hiện bản dịch rỗng, quá ngắn và sai thuật ngữ; cảnh báo được lưu trong PostgreSQL.
- Giao diện QA hỗ trợ nhảy tới đoạn lỗi, bỏ qua/khôi phục cảnh báo và chặn duyệt khi còn lỗi bắt buộc.
- Thư viện tiểu thuyết và quản lý chương trên frontend.
- Health check riêng cho tiến trình và database.

## Công nghệ

- Backend: Node.js, Express, Prisma, PostgreSQL.
- Frontend: React, Vite, Tailwind CSS.
- AI: Google Gemini qua `@google/genai`.
- Test: Node.js test runner, Oxlint và Vite production build.

## Chạy dự án không dùng Docker

Yêu cầu: Node.js 22+, npm và PostgreSQL đang chạy cục bộ.

### 1. Backend

```powershell
cd backend
Copy-Item .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Cập nhật `DATABASE_URL`, `JWT_SECRET` và `GEMINI_API_KEY` trong `backend/.env` trước khi chạy. Tài khoản seed dùng cho môi trường phát triển:

- Email: `demo@novelverse.local`
- Mật khẩu: `Demo1234`

### 2. Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`, backend tại `http://localhost:5000`.

## Kiểm tra trước khi commit

```powershell
cd backend
npm run check
npm audit --omit=dev

cd ..\frontend
npm run lint
npm run build
```

CI chạy đúng bốn cổng kiểm tra trên. Kiểm thử API tích hợp cần một PostgreSQL thử nghiệm riêng; CI hiện không tự khởi tạo database để tuân theo quy trình không dùng Docker.

## Biến môi trường quan trọng

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `JWT_SECRET` | Khóa ký JWT; production phải dài ít nhất 32 ký tự |
| `GEMINI_API_KEY` | Khóa Google Gemini |
| `GEMINI_MODEL` | Model Gemini, mặc định `gemini-2.5-flash` |
| `GEMINI_TIMEOUT_MS` | Timeout cho request Gemini |
| `FRONTEND_URL` | Origin frontend được phép gọi API |
| `VITE_API_URL` | URL API mà frontend sử dụng |

## Sinh viên thực hiện

- Nguyễn Việt Lâm
- MSSV: 2380601183
- Lớp: 23DTHC6
