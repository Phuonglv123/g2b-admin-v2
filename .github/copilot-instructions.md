- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions (skipped - no extensions required)
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Ensure Documentation is Complete

## Project Summary

Admin panel hiện đại cho G2B, xây dựng bằng React 19.2 + TypeScript 5.9 + Vite 7.3 + Tailwind CSS v4 + shadcn/ui.

### Mục tiêu chính
- **Giao diện quản trị đơn giản & hiện đại** — UI/UX tối giản, loại bỏ giao diện rườm rà
- **Trích xuất PDF bằng AI** — Dùng Claude Proxy Server phân tích tài liệu PDF (hóa đơn, báo cáo, hợp đồng)
- **Export dữ liệu sản phẩm** — Xuất file Excel (.xlsx) và PowerPoint (.pptx) theo mẫu để gửi khách hàng
- **Nền tảng AI mở rộng** — Kiến trúc hỗ trợ tích hợp các tính năng AI tiên tiến

### Tech Stack
- React 19.2, TypeScript 5.9, Vite 7.3, React Router 7
- Tailwind CSS v4, shadcn/ui
- Supabase (Auth, Database, Storage)
- ExcelJS, PDF.js, Claude AI
- Docker, Vercel deployment

### Conventions
- File PDF mẫu lưu trong `pdfs/` để thử nghiệm
- Services/utilities đặt trong `src/lib/`
- Page components trong `src/pages/`, routes trong `src/routes/`
