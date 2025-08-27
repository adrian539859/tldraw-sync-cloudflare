import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(() => {
	const isCloudflare = process.env.CLOUDFLARE === 'true'
	
	const config = {
		plugins: [react()],
		server: {
			port: 5137
		},
		build: {
			outDir: 'dist/client'
		}
	}

	// Add Cloudflare plugin only when explicitly requested
	if (isCloudflare) {
		config.plugins.push(cloudflare())
	}

	return config
})
