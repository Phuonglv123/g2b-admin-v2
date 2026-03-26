# G2B Admin v2

Modern React admin panel built with the latest stable technologies.

## Tech Stack

- **React 19.2** - Latest stable React
- **TypeScript 5.9** - Type-safe development
- **Vite 7.3** - Fast build tooling
- **React Router 7** - Client-side routing
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components

## Project Structure

```
src/
├── components/
│   └── ui/           # shadcn/ui components (Button, etc.)
├── layouts/
│   └── RootLayout.tsx # Main layout with navigation
├── pages/
│   ├── HomePage.tsx
│   ├── AnalyticsPage.tsx
│   ├── SettingsPage.tsx
│   └── NotFoundPage.tsx
├── routes/
│   └── AppRouter.tsx # Route configuration
├── lib/
│   └── utils.ts      # Utility functions (cn helper)
├── App.tsx
├── main.tsx
└── index.css         # Tailwind + theme variables
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

### Preview production build

```bash
npm run preview
```

## Features

- ✅ Page-based routing with React Router
- ✅ Responsive navigation layout
- ✅ shadcn/ui components with Tailwind CSS v4
- ✅ TypeScript path aliases (`@/*`)
- ✅ Dark mode support (CSS variables)
- ✅ Production-ready build setup

## Adding More Pages

1. Create a new page component in `src/pages/`
2. Add the route in `src/routes/AppRouter.tsx`
3. Add navigation link in `src/layouts/RootLayout.tsx` (optional)

## Adding shadcn/ui Components

Install additional components using the shadcn CLI:

```bash
npx shadcn@latest add [component-name]
```

Example:
```bash
npx shadcn@latest add card
npx shadcn@latest add dialog
```

## License

MIT

## AI-Powered PDF Extraction

This project uses Claude AI for intelligent document extraction. The architecture consists of:

1. **Claude Proxy Server** (`/server`) - A Node.js/Express server that handles Claude API communication
2. **Modern PDF Uploader** - A beautiful UI component for uploading and analyzing documents

### Running the AI extraction feature

```bash
# 1. Set up the proxy server
cd server
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 2. Start the proxy server
npm install
npm start

# 3. Or use Docker Compose (from project root)
docker-compose up -d
```

See `/server/README.md` for detailed setup instructions.