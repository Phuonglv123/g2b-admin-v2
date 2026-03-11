# Docker Deployment Guide

## Prerequisites

- Docker và Docker Compose đã được cài đặt trên server
- Các API keys cho Supabase và Gemini

## Cấu trúc files

```
├── Dockerfile          # Multi-stage build configuration
├── docker-compose.yml  # Docker Compose configuration
├── nginx.conf          # Nginx configuration for SPA
├── .dockerignore       # Files to exclude from Docker build
└── .env                # Environment variables (create from .env.example)
```

## Hướng dẫn Deploy

### 1. Chuẩn bị Environment Variables

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env` với các giá trị thực:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 2. Build và Run với Docker Compose

```bash
# Build và start container
docker compose up -d --build

# Xem logs
docker compose logs -f

# Stop container
docker compose down
```

### 3. Build và Run với Docker (không dùng Compose)

```bash
# Build image
docker build \
  --build-arg VITE_SUPABASE_URL=your_url \
  --build-arg VITE_SUPABASE_ANON_KEY=your_key \
  --build-arg VITE_GEMINI_API_KEY=your_gemini_key \
  -t g2b-admin-v2 .

# Run container
docker run -d -p 3000:80 --name g2b-admin-v2 g2b-admin-v2
```

## Các lệnh hữu ích

```bash
# Kiểm tra container đang chạy
docker ps

# Xem logs của container
docker logs g2b-admin-v2

# Truy cập vào container
docker exec -it g2b-admin-v2 sh

# Restart container
docker compose restart

# Rebuild và restart
docker compose up -d --build --force-recreate

# Xóa tất cả (container, network)
docker compose down -v
```

## Health Check

Ứng dụng có health check endpoint tại:

```
http://localhost:3000/health
```

## Cấu hình Port

Mặc định ứng dụng chạy trên port `3000`. Để thay đổi port, sửa trong `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # Đổi từ 3000 sang 8080
```

## Production với HTTPS (Reverse Proxy)

Khi deploy production, nên sử dụng reverse proxy như Traefik hoặc Nginx Proxy Manager để xử lý SSL/HTTPS.

### Ví dụ với Traefik:

```yaml
services:
  g2b-admin:
    # ... existing config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.g2b-admin.rule=Host(`admin.yourdomain.com`)"
      - "traefik.http.routers.g2b-admin.tls.certresolver=letsencrypt"
```

## Troubleshooting

### Container không start được

```bash
# Kiểm tra logs
docker compose logs g2b-admin

# Kiểm tra resource
docker stats
```

### Build thất bại

```bash
# Clear cache và rebuild
docker compose build --no-cache
```

### Ứng dụng không load được

- Kiểm tra nginx logs trong container
- Đảm bảo các environment variables được set đúng
- Kiểm tra firewall cho phép port 3000
