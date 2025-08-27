import * as fs from 'node:fs'
import * as path from 'node:path'
import { Request, Response } from 'express'
import multer from 'multer'

// Local storage directory for assets
const ASSETS_DIR = path.join(process.cwd(), 'data', 'uploads')

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
	fs.mkdirSync(ASSETS_DIR, { recursive: true })
}

// Simple in-memory cache for asset responses
const assetCache = new Map<string, { data: Buffer; headers: any; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function getAssetPath(uploadId: string): string {
	// Sanitize the uploadId to prevent directory traversal
	const sanitized = uploadId.replace(/[^a-zA-Z0-9_-]+/g, '_')
	return path.join(ASSETS_DIR, sanitized)
}

export async function handleAssetUpload(req: Request, res: Response) {
	try {
		const { uploadId } = req.params
		const contentType = req.headers['content-type'] || ''

		// Validate content type
		if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
			return res.status(400).json({ error: 'Invalid content type' })
		}

		const assetPath = getAssetPath(uploadId)

		// Check if asset already exists
		if (fs.existsSync(assetPath)) {
			return res.status(409).json({ error: 'Upload already exists' })
		}

		// Get the buffer from the request body (Express raw middleware provides this)
		const buffer = req.body as Buffer
		
		if (!buffer || buffer.length === 0) {
			return res.status(400).json({ error: 'No data received' })
		}
		
		// Write file with metadata
		const metadata = {
			contentType,
			size: buffer.length,
			uploadedAt: new Date().toISOString(),
			originalHeaders: req.headers
		}
		
		fs.writeFileSync(assetPath, buffer)
		fs.writeFileSync(`${assetPath}.meta`, JSON.stringify(metadata))

		res.json({ ok: true })

	} catch (error) {
		console.error('Error handling asset upload:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
}

export async function handleAssetDownload(req: Request, res: Response) {
	try {
		const { uploadId } = req.params
		const assetPath = getAssetPath(uploadId)
		const metaPath = `${assetPath}.meta`

		// Check cache first
		const cacheKey = uploadId
		const cached = assetCache.get(cacheKey)
		if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
			// Set headers from cache
			Object.entries(cached.headers).forEach(([key, value]) => {
				res.set(key, value as string)
			})
			return res.send(cached.data)
		}

		// Check if asset exists
		if (!fs.existsSync(assetPath)) {
			return res.status(404).json({ error: 'Asset not found' })
		}

		// Read metadata
		let metadata: any = {}
		try {
			if (fs.existsSync(metaPath)) {
				metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
			}
		} catch (error) {
			console.warn('Failed to read asset metadata:', error)
		}

		// Read asset data
		const data = fs.readFileSync(assetPath)

		// Set appropriate headers
		const headers: any = {
			'Content-Type': metadata.contentType || 'application/octet-stream',
			'Content-Length': data.length.toString(),
			'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
			'ETag': `"${uploadId}"`
		}

		// Handle range requests for video streaming
		const range = req.headers.range
		if (range) {
			const parts = range.replace(/bytes=/, "").split("-")
			const start = parseInt(parts[0], 10)
			const end = parts[1] ? parseInt(parts[1], 10) : data.length - 1
			const chunksize = (end - start) + 1
			const chunk = data.subarray(start, end + 1)
			
			headers['Content-Range'] = `bytes ${start}-${end}/${data.length}`
			headers['Accept-Ranges'] = 'bytes'
			headers['Content-Length'] = chunksize.toString()
			
			res.status(206)
			Object.entries(headers).forEach(([key, value]) => {
				res.set(key, value as string)
			})
			return res.send(chunk)
		}

		// Cache the response (for complete requests only)
		assetCache.set(cacheKey, {
			data,
			headers,
			timestamp: Date.now()
		})

		// Clean up old cache entries periodically
		if (assetCache.size > 1000) {
			const cutoff = Date.now() - CACHE_TTL
			for (const [key, value] of assetCache.entries()) {
				if (value.timestamp < cutoff) {
					assetCache.delete(key)
				}
			}
		}

		// Set headers and send response
		Object.entries(headers).forEach(([key, value]) => {
			res.set(key, value as string)
		})
		res.send(data)

	} catch (error) {
		console.error('Error handling asset download:', error)
		res.status(500).json({ error: 'Internal server error' })
	}
}