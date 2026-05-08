# Claude AI Proxy Server

A simple Node.js/Express server that acts as a proxy between the frontend and Claude AI API for PDF/image data extraction.

## Why a Proxy Server?

Claude's API requires server-side authentication with an API key. For security reasons, we cannot expose this key in the frontend. This proxy server:

1. Receives files from the frontend
2. Processes and sends them to Claude API
3. Returns the extracted data back to the frontend

## Setup

### 1. Environment Variables

Copy the example environment file and add your Claude API key:

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
PORT=3001
CORS_ORIGIN=*
# Optional: speed tuning for Google Slides batch export
IMAGE_PROXY_PERMISSION_WAIT_MS=300
BATCH_EXPORT_FAST_MODE_THRESHOLD=12
```

### 2. Running Locally

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Or start production server
npm start
```

The server will start on `http://localhost:3001`

### 3. Running with Docker

#### Single Container

```bash
docker build -t claude-proxy .
docker run -p 3001:3001 -e ANTHROPIC_API_KEY=your_key claude-proxy
```

#### With Docker Compose (recommended)

From the project root:

```bash
# Set your API key in .env file at project root
echo "ANTHROPIC_API_KEY=your_key" >> .env

# Start all services
docker-compose up -d

# Or just the proxy server
docker-compose up -d claude-proxy
```

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Extract Data from File

```
POST /api/extract
Content-Type: multipart/form-data

file: <PDF or image file>
```

Response:
```json
{
  "success": true,
  "data": {
    "provider_name": "Company Name",
    "products": [...],
    "detected_items": [...]
  },
  "usage": {
    "inputTokens": 1234,
    "outputTokens": 567
  }
}
```

### Match Image to Products

```
POST /api/match-image
Content-Type: multipart/form-data

image: <image file>
products: <JSON string of products array>
```

## Supported File Types

- PDF files (`.pdf`)
- Images: PNG, JPEG, WebP, GIF

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Frontend  │────▶│  Proxy Server   │────▶│  Claude API  │
│   (React)   │◀────│   (Express)     │◀────│  (Anthropic) │
└─────────────┘     └─────────────────┘     └──────────────┘
      :3000              :3001                    API
```

## Security Notes

- Never expose your `ANTHROPIC_API_KEY` in frontend code
- Use environment variables for all secrets
- Configure `CORS_ORIGIN` properly in production
- Consider adding rate limiting for production use
