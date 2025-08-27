import { Request, Response } from 'express'
import fetch from 'node-fetch'

// Simple cache for URL unfurling to avoid repeated requests
const unfurlCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function handleUnfurlRequest(req: Request, res: Response) {
	try {
		const url = req.query.url as string
		
		if (!url) {
			return res.status(400).json({ error: 'Missing url parameter' })
		}

		// Validate URL
		let targetUrl: URL
		try {
			targetUrl = new URL(url)
			if (!['http:', 'https:'].includes(targetUrl.protocol)) {
				return res.status(400).json({ error: 'Invalid URL protocol' })
			}
		} catch (error) {
			return res.status(400).json({ error: 'Invalid URL' })
		}

		// Check cache first
		const cached = unfurlCache.get(url)
		if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
			return res.json(cached.data)
		}

		// Fetch the URL content
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
		
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; TldrawBot/1.0)'
			},
			signal: controller.signal
		})

		clearTimeout(timeoutId)

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		const html = await response.text()
		
		// Extract metadata using simple regex patterns
		const metadata = extractMetadata(html, url)

		// Cache the result
		unfurlCache.set(url, {
			data: metadata,
			timestamp: Date.now()
		})

		// Clean up old cache entries periodically
		if (unfurlCache.size > 1000) {
			const cutoff = Date.now() - CACHE_TTL
			for (const [key, value] of unfurlCache.entries()) {
				if (value.timestamp < cutoff) {
					unfurlCache.delete(key)
				}
			}
		}

		res.json(metadata)

	} catch (error) {
		console.error('Error unfurling URL:', error)
		res.status(500).json({ 
			error: 'Failed to unfurl URL',
			details: error instanceof Error ? error.message : 'Unknown error'
		})
	}
}

function extractMetadata(html: string, url: string): any {
	const metadata: any = {
		url: url,
		title: '',
		description: '',
		image: '',
		favicon: ''
	}

	// Extract title
	const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
	if (titleMatch) {
		metadata.title = titleMatch[1].trim()
	}

	// Extract Open Graph metadata
	const ogTitle = html.match(/<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i)
	if (ogTitle) {
		metadata.title = ogTitle[1].trim()
	}

	const ogDescription = html.match(/<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i)
	if (ogDescription) {
		metadata.description = ogDescription[1].trim()
	}

	const ogImage = html.match(/<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i)
	if (ogImage) {
		metadata.image = resolveUrl(ogImage[1].trim(), url)
	}

	// Extract standard meta description if OG description not found
	if (!metadata.description) {
		const metaDescription = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']+)["\'][^>]*>/i)
		if (metaDescription) {
			metadata.description = metaDescription[1].trim()
		}
	}

	// Extract favicon
	const faviconMatch = html.match(/<link[^>]*rel=["\'][^"']*icon[^"']*["\'][^>]*href=["\']([^"']+)["\'][^>]*>/i)
	if (faviconMatch) {
		metadata.favicon = resolveUrl(faviconMatch[1].trim(), url)
	}

	// Fallback to default favicon path if not found
	if (!metadata.favicon) {
		try {
			const urlObj = new URL(url)
			metadata.favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`
		} catch (error) {
			// Ignore favicon extraction error
		}
	}

	return metadata
}

function resolveUrl(relativeUrl: string, baseUrl: string): string {
	try {
		return new URL(relativeUrl, baseUrl).toString()
	} catch (error) {
		return relativeUrl
	}
}