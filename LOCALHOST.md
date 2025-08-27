# Localhost Development Guide

This repository now supports both **Cloudflare Workers** deployment and **localhost development** without requiring any Cloudflare services.

## Running Localhost Version

The localhost version replaces all Cloudflare services with local equivalents:

- **Cloudflare Workers** → Node.js Express server
- **Durable Objects** → In-memory room management with local persistence
- **R2 Storage** → Local file system storage
- **Edge Caching** → Simple in-memory caching
- **Workers Unfurl** → Local URL metadata extraction

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the application:**
   ```bash
   npm run build
   ```

3. **Start both client and server:**
   ```bash
   npm run dev
   ```
   This runs both the Vite dev server (port 5137) and Node.js backend (port 3001) concurrently.

4. **Open your browser:**
   Navigate to http://localhost:5137

You'll see a **"🏠 Localhost Mode"** indicator in the top-left corner confirming you're running the local version.

### Individual Commands

- **Client only:** `npm run dev:client` (port 5137)
- **Server only:** `npm run dev:server` (port 3001)
- **Build server:** `npm run build:server`

### Data Storage

Local data is stored in the `data/` directory:
- `data/rooms/` - Room state persistence
- `data/uploads/` - Asset uploads (images/videos)

This directory is gitignored and created automatically.

### API Endpoints

The localhost server provides the same API as the Cloudflare version:

- `GET /api/health` - Health check
- `GET /api/connect/:roomId` - WebSocket connection for sync
- `POST /api/uploads/:uploadId` - Asset upload
- `GET /api/uploads/:uploadId` - Asset download  
- `GET /api/unfurl?url=...` - URL metadata extraction

## Running Cloudflare Version

To run the original Cloudflare version:

1. **Set environment variable:**
   ```bash
   CLOUDFLARE=true npm run dev:cloudflare
   ```

2. **Or use wrangler directly:**
   ```bash
   wrangler dev
   ```

## Switching Between Modes

The application automatically detects the environment:

- **Localhost mode** (`localhost` domain) → Connects to Node.js server on port 3001
- **Cloudflare mode** (any other domain) → Uses Cloudflare Workers

No code changes needed when deploying to either environment.

## Production Deployment

### Localhost Production
```bash
npm run build
npm run build:server
node dist/server/server.js
```

### Cloudflare Production
```bash
CLOUDFLARE=true npm run build
wrangler deploy
```

## Features Supported

Both localhost and Cloudflare versions support:

✅ Real-time multiplayer sync  
✅ Asset upload/download (images, videos)  
✅ URL unfurling for bookmark previews  
✅ Room persistence  
✅ Caching for performance  
✅ Same client-side code  

The localhost version provides an identical experience to the Cloudflare version, making development and testing much easier!