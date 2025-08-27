import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import * as path from 'node:path'
import * as url from 'node:url'
import express from 'express'
import { roomManager } from './RoomManager'
import { handleAssetUpload, handleAssetDownload } from './AssetStorage'
import { handleUnfurlRequest } from './UrlUnfurl'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

const PORT = process.env.PORT || 3001

// Enable CORS for all requests
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*')
	res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
	
	if (req.method === 'OPTIONS') {
		res.sendStatus(200)
	} else {
		next()
	}
})

// Parse JSON bodies for API requests
app.use(express.json({ limit: '50mb' }))
app.use(express.raw({ type: ['image/*', 'video/*'], limit: '50mb' }))

// Serve static client files
const clientDir = path.join(process.cwd(), 'dist', 'client')
app.use(express.static(clientDir))

// API Routes

// Asset upload endpoint
app.post('/api/uploads/:uploadId', handleAssetUpload)

// Asset download endpoint  
app.get('/api/uploads/:uploadId', handleAssetDownload)

// URL unfurling endpoint
app.get('/api/unfurl', handleUnfurlRequest)

// Health check endpoint
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Catch-all handler for client-side routing
app.get('*', (req, res) => {
	res.sendFile(path.join(clientDir, 'index.html'))
})

// WebSocket connection handling
wss.on('connection', (ws: WebSocket, req) => {
	try {
		const urlParts = url.parse(req.url || '', true)
		const pathParts = urlParts.pathname?.split('/') || []
		const queryParams = urlParts.query || {}
		
		// Extract room ID from path: /api/connect/:roomId
		if (pathParts.length >= 4 && pathParts[1] === 'api' && pathParts[2] === 'connect') {
			const roomId = pathParts[3]
			const sessionId = queryParams.sessionId as string
			
			console.log(`WebSocket connection for room: ${roomId}, sessionId: ${sessionId}`)
			
			if (!sessionId) {
				console.warn('Missing sessionId in WebSocket connection')
				ws.close(1003, 'Missing sessionId')
				return
			}
			
			// Handle the WebSocket connection through the room manager
			roomManager.handleWebSocketConnection(roomId, ws, { sessionId, query: queryParams })
				.then((actualSessionId) => {
					console.log(`Session ${actualSessionId} connected to room ${roomId}`)
				})
				.catch((error) => {
					console.error('Error handling WebSocket connection:', error)
					ws.close(1011, 'Connection failed')
				})
		} else {
			console.warn('Invalid WebSocket path:', urlParts.pathname)
			ws.close(1003, 'Invalid path')
		}
	} catch (error) {
		console.error('Error processing WebSocket connection:', error)
		ws.close(1011, 'Connection error')
	}
})

// Start the server
server.listen(PORT, () => {
	console.log(`🚀 Tldraw sync server running on http://localhost:${PORT}`)
	console.log(`📁 Client files served from: ${clientDir}`)
	console.log(`🗄️  Data directory: ${path.join(process.cwd(), 'data')}`)
})

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('Shutting down server...')
	server.close(() => {
		console.log('Server shut down successfully')
		process.exit(0)
	})
})

process.on('SIGTERM', () => {
	console.log('Shutting down server...')
	server.close(() => {
		console.log('Server shut down successfully')
		process.exit(0)
	})
})