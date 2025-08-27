// Configuration for different environments
export const config = {
	// Auto-detect if we're running in localhost mode
	isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
	
	// WebSocket URL - will be different for localhost vs Cloudflare
	getWebSocketUrl: (roomId: string) => {
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			// Localhost mode - connect to Node.js server WebSocket on port 3001
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
			return `${protocol}//localhost:3001/api/connect/${roomId}`
		} else {
			// Cloudflare mode - use relative URL
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
			return `${protocol}//${window.location.host}/api/connect/${roomId}`
		}
	},

	// API base URL  
	getApiUrl: (path: string) => {
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			// Localhost mode - point to Node.js server on port 3001
			return `http://localhost:3001/api${path}`
		} else {
			// Cloudflare mode - use relative URL
			return `/api${path}`
		}
	}
}