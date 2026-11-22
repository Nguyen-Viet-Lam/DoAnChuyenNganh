# Biên bản kiểm tra tuần 6

Ngày kiểm tra: 22/11/2026  
Nhánh: `feat/week-6-quality-and-library`

## Phạm vi đã nghiệm thu bằng kiểm tra tự động

| Hạng mục | Lệnh kiểm tra | Kết quả |
| --- | --- | --- |
| Logic trạng thái chương | `npm test` | Đạt |
| QA đoạn rỗng/quá ngắn/thuật ngữ | `npm test` | Đạt |
| Validation đăng ký | `npm test` | Đạt |
| Prisma schema | `npx prisma validate` | Đạt |
| Dependency backend production | `npm audit --omit=dev` | 0 lỗ hổng |
| Frontend lint | `npm run lint` | Đạt, 0 cảnh báo |
| Frontend production build | `npm run build` | Đạt |

Tổng cộng backend có 9 bài unit test, đều đạt.

## Các luồng đã hoàn thiện

1. Người dùng đăng nhập và chỉ nhìn thấy truyện thuộc quyền quản lý.
2. Tạo/sửa/xóa tiểu thuyết và chương trên frontend.
3. Mở chương thật trong trình biên tập, không còn ID demo.
4. Dịch chương hoặc dịch lại đoạn qua endpoint có kiểm tra quota.
5. Auto-save theo hàng đợi tuần tự; lưu bản nháp trước khi dịch lại.
6. Chạy QA, nhảy tới đoạn lỗi, bỏ qua hoặc khôi phục cảnh báo mức warning.
7. Không cho duyệt chương nếu còn đoạn rỗng/chưa hoàn thành hoặc QA error.

## Kiểm tra tích hợp đang tạm hoãn

Theo yêu cầu không dùng Docker, PostgreSQL container đã dừng. Vì vậy vòng kiểm tra hiện tại không chạy lại API smoke test có database. Trước khi merge hoặc triển khai staging cần dùng PostgreSQL cục bộ/staging và chạy:

```powershell
cd backend
npx prisma migrate deploy
npm run db:seed
npm start
```

Sau đó xác nhận:

- `GET /api/health` trả 200.
- `GET /api/health/ready` trả 200 và `database: connected`.
- Đăng nhập bằng tài khoản seed.
- Tạo truyện, tạo chương, dịch/chia đoạn và chạy QA.
- Sửa một đoạn thành rỗng phải chuyển về `PENDING` và tạo QA error.
- Không thể duyệt khi còn QA error.

## Điều kiện trước khi deploy

- Cấu hình database PostgreSQL quản lý bên ngoài.
- Đặt `JWT_SECRET` production tối thiểu 32 ký tự.
- Cấu hình `FRONTEND_URL` đúng domain, không mở CORS toàn cục.
- Chạy `npx prisma migrate deploy` trong release step.
- Đặt `VITE_API_URL` trỏ tới backend.
- Chạy lại smoke test trên staging trước production.
