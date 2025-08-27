import { RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import {
	TLRecord,
	createTLSchema,
	// defaultBindingSchemas,
	defaultShapeSchemas,
} from '@tldraw/tlschema'
import throttle from 'lodash.throttle'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { WebSocket } from 'ws'

// add custom shapes and bindings here if needed:
const schema = createTLSchema({
	shapes: { ...defaultShapeSchemas },
	// bindings: { ...defaultBindingSchemas },
})

// Local storage directory for room persistence
const ROOMS_DIR = path.join(process.cwd(), 'data', 'rooms')

// Ensure data directory exists
if (!fs.existsSync(ROOMS_DIR)) {
	fs.mkdirSync(ROOMS_DIR, { recursive: true })
}

export class LocalRoomManager {
	private rooms: Map<string, Promise<TLSocketRoom<TLRecord, void>>> = new Map()
	private roomData: Map<string, any> = new Map()

	async getRoom(roomId: string): Promise<TLSocketRoom<TLRecord, void>> {
		if (!this.rooms.has(roomId)) {
			this.rooms.set(roomId, this.createRoom(roomId))
		}
		return this.rooms.get(roomId)!
	}

	private async createRoom(roomId: string): Promise<TLSocketRoom<TLRecord, void>> {
		// Try to load existing room data from file
		const roomFile = path.join(ROOMS_DIR, `${roomId}.json`)
		let snapshot: RoomSnapshot | undefined = undefined

		try {
			if (fs.existsSync(roomFile)) {
				const data = fs.readFileSync(roomFile, 'utf8')
				snapshot = JSON.parse(data)
			}
		} catch (error) {
			console.warn(`Failed to load room ${roomId}:`, error)
		}

		const room = new TLSocketRoom<TLRecord, void>({
			initialSnapshot: snapshot,
			schema,
			onDataChange: () => {
				// Persist room data when it changes
				this.schedulePersistRoom(roomId, room)
			},
		})

		return room
	}

	// Throttle persistence to avoid too frequent writes
	private schedulePersistRoom = throttle(async (roomId: string, room: TLSocketRoom<TLRecord, void>) => {
		try {
			const snapshot = JSON.stringify(room.getCurrentSnapshot())
			const roomFile = path.join(ROOMS_DIR, `${roomId}.json`)
			fs.writeFileSync(roomFile, snapshot)
		} catch (error) {
			console.error(`Failed to persist room ${roomId}:`, error)
		}
	}, 10_000)

	async handleWebSocketConnection(roomId: string, ws: WebSocket, request: { sessionId: string; query: any }) {
		const room = await this.getRoom(roomId)
		
		// Use the provided session ID
		const sessionId = request.sessionId
		
		// Create a socket adapter that matches the Cloudflare WebSocket interface
		const socketAdapter = {
			get readyState() {
				return ws.readyState
			},
			send: (data: any) => {
				if (ws.readyState === WebSocket.OPEN) {
					const message = typeof data === 'string' ? data : JSON.stringify(data)
					ws.send(message)
				}
			},
			close: () => {
				ws.close()
			},
			addEventListener: (event: string, handler: any) => {
				if (event === 'message') {
					ws.on('message', (data) => {
						handler({ data: data.toString() })
					})
				} else if (event === 'close') {
					ws.on('close', handler)
				}
			},
			removeEventListener: () => {
				// Not implemented for simplicity
			}
		}

		// Use the TLSocketRoom API to handle the connection
		room.handleSocketConnect({ sessionId, socket: socketAdapter })
		
		// Set up WebSocket cleanup
		ws.on('close', () => {
			// The room will handle session cleanup internally
		})

		ws.on('error', (error) => {
			console.error('WebSocket error:', error)
		})
		
		return sessionId
	}
}

// Singleton instance
export const roomManager = new LocalRoomManager()