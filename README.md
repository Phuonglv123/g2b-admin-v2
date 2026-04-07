# G2B Admin v2

Admin panel hiện đại được xây dựng bằng React, TypeScript, Vite, Tailwind CSS và shadcn/ui — cung cấp giao diện quản trị đẹp mắt, đơn giản, dễ sử dụng và có khả năng mở rộng cao cho các ứng dụng web.

## Ý tưởng dự án

- **Giao diện quản trị đơn giản & hiện đại** — Loại bỏ các giao diện rườm rà, tập trung vào UI/UX tối giản, trực quan giúp người dùng thao tác nhanh chóng và hiệu quả.
- **Trích xuất thông tin tài liệu PDF bằng AI** — Tích hợp Claude Proxy Server để phân tích và trích xuất dữ liệu từ các loại tài liệu PDF (hóa đơn, báo cáo, hợp đồng,...). Các file PDF mẫu được lưu trong thư mục `pdfs/` để phục vụ thử nghiệm và phát triển.
- **Xuất dữ liệu sản phẩm theo mẫu** — Dựa trên thông tin sản phẩm đã quản lý, hỗ trợ export ra file Excel và PowerPoint theo mẫu để gửi đến khách hàng.
- **Nền tảng tích hợp AI tiên tiến** — Được thiết kế để giúp nhà phát triển nhanh chóng xây dựng các ứng dụng quản trị hiệu quả, dễ bảo trì, đồng thời cung cấp nền tảng mạnh mẽ để tích hợp các tính năng AI.

## Tech Stack

- **React 19.2** — Latest stable React
- **TypeScript 5.9** — Type-safe development
- **Vite 7.3** — Fast build tooling
- **React Router 7** — Client-side routing
- **Tailwind CSS 4** — Utility-first styling
- **shadcn/ui** — Beautiful, accessible components
- **Supabase** — Backend-as-a-Service (Auth, Database, Storage)
- **ExcelJS** — Xuất file Excel
- **PDF.js** — Đọc và xử lý file PDF
- **Claude AI** — Trích xuất thông tin tài liệu bằng AI

## Project Structure

```
src/
├── components/
│   ├── ui/             # shadcn/ui components
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard widgets (charts, stats, tables)
│   ├── inventory/      # PDF upload, image editor
│   ├── layout/         # Header, Sidebar
│   └── location/       # Vietnam address selector
├── contexts/           # React contexts (Auth)
├── layouts/
│   └── RootLayout.tsx  # Main layout
├── pages/              # All page components
├── routes/
│   └── AppRouter.tsx   # Route configuration
├── lib/                # Services & utilities
│   ├── supabase.ts     # Supabase client
│   ├── claudeService.ts        # Claude AI integration
│   ├── excelExportService.ts   # Excel export
│   ├── slidesExportService.ts  # PowerPoint export
│   ├── productProvider.ts      # Product data
│   ├── customerProvider.ts     # Customer data
│   └── ...
└── types/              # TypeScript type definitions
server/                 # Claude Proxy Server (Node.js/Express)
pdfs/                   # File PDF mẫu cho thử nghiệm
supabase/               # Database migrations
```

## Getting Started

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

## Tính năng chính

- ✅ Giao diện quản trị đơn giản, hiện đại (shadcn/ui + Tailwind CSS v4)
- ✅ Xác thực người dùng với Supabase Auth
- ✅ Quản lý sản phẩm, khách hàng, nhà cung cấp
- ✅ Trích xuất thông tin từ PDF bằng Claude AI
- ✅ Xuất dữ liệu sản phẩm ra Excel và PowerPoint theo mẫu
- ✅ Dashboard với biểu đồ và thống kê
- ✅ Routing với React Router, TypeScript path aliases (`@/*`)
- ✅ Dark mode support
- ✅ Production-ready (Docker, Vercel)

## AI-Powered PDF Extraction

Sử dụng Claude AI để trích xuất thông tin thông minh từ các loại tài liệu PDF.

1. **Claude Proxy Server** (`/server`) — Node.js/Express server xử lý giao tiếp với Claude API
2. **Modern PDF Uploader** — UI component đẹp mắt để upload và phân tích tài liệu
3. **PDF mẫu** (`/pdfs`) — Các file PDF mẫu (hóa đơn, báo cáo, hợp đồng,...) để thử nghiệm

### Chạy tính năng trích xuất PDF

```bash
# 1. Cấu hình proxy server
cd server
cp .env.example .env
# Thêm ANTHROPIC_API_KEY vào file .env

# 2. Khởi động proxy server
npm install && npm start

# 3. Hoặc dùng Docker Compose
docker-compose up -d
```

Xem `/server/README.md` để biết thêm chi tiết.

## Export dữ liệu

- **Excel**: Xuất danh sách sản phẩm, thông tin khách hàng ra file `.xlsx` theo mẫu
- **PowerPoint**: Tạo bài thuyết trình sản phẩm tự động từ dữ liệu để gửi cho khách hàng

## License

MIT


Mô tả lại ý tưởng của dự án như sau:
- Đây là nơi để lưu trữ mã nguồn của một dự án admin panel hiện đại được xây dựng bằng React, TypeScript, Vite, Tailwind CSS và shadcn/ui. Dự án này cung cấp một giao diện quản trị đẹp mắt, dễ sử dụng và có khả năng mở rộng cao cho các ứng dụng web. Ngoài ra, dự án còn tích hợp tính năng trích xuất thông tin từ tài liệu PDF bằng AI thông qua Claude Proxy Server, giúp người dùng dễ dàng phân tích và xử lý dữ liệu từ các tài liệu. Dựhiện đại, đồng thời cung cấp một nền tảng mạnh mẽ để tích hợp các tính năng AI tiên tiến. án này được thiết kế để giúp các nhà phát triển nhanh chóng xây dựng các ứng dụng quản trị hiệu quả và dễ bảo trì, đồng thời cung cấp một nền tảng mạnh mẽ để tích hợp các tính năng AI tiên tiến.
- Lưu trữ các file pdf mẫu trong thư mục `pdfs/` để phục vụ cho việc thử nghiệm và phát triển tính năng trích xuất thông tin từ tài liệu PDF bằng AI. Các file này có thể bao gồm các loại tài liệu khác nhau như hóa đơn, báo cáo, hợp đồng, v.v., giúp đảm bảo rằng tính năng trích xuất hoạt động hiệu quả trên nhiều loại tài liệu khác nhau.
- Lượt bỏ các giao diện rườm rà, thiết UI/Ux đơn giản hiện đại
- Dựa vào các thông tin sản phẩm từ đó export được các file excel và ppt theo mẫu để gửi đến khách hàng