/**
 * 🔌 WebSocket Handler
 * Real-time features
 */

const WebSocket = require('ws');

class WebSocketHandler {
    constructor(server) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });
        this.clients = new Map(); // userId -> ws
        this.rooms = new Map();   // roomId -> Set of userIds
        
        this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
        console.log('WebSocket server initialized');
    }
    
    handleConnection(ws, req) {
        const userId = null; // Will be set after auth
        
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        
        ws.on('message', (data) => this.handleMessage(ws, data));
        
        ws.on('close', () => this.handleDisconnect(ws));
        
        ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to MRABT: The Lost Block' }));
    }
    
    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'auth':
                    // Authenticate user
                    ws.userId = message.userId;
                    this.clients.set(message.userId, ws);
                    ws.send(JSON.stringify({ type: 'authenticated', userId: message.userId }));
                    break;
                    
                case 'join_room':
                    this.joinRoom(ws, message.roomId);
                    break;
                    
                case 'leave_room':
                    this.leaveRoom(ws, message.roomId);
                    break;
                    
                case 'puzzle_update':
                    this.broadcastToRoom(message.roomId, {
                        type: 'puzzle_update',
                        userId: ws.userId,
                        level: message.level,
                        progress: message.progress
                    });
                    break;
                    
                case 'leaderboard_update':
                    this.broadcastAll({ type: 'leaderboard', data: message.data });
                    break;
                    
                case 'chat':
                    this.broadcastToRoom(message.roomId, {
                        type: 'chat',
                        userId: ws.userId,
                        message: message.text
                    });
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (e) {
            console.error('WebSocket message error:', e);
        }
    }
    
    handleDisconnect(ws) {
        if (ws.userId) {
            this.clients.delete(ws.userId);
            
            // Remove from all rooms
            for (const [roomId, users] of this.rooms) {
                if (users.has(ws.userId)) {
                    users.delete(ws.userId);
                    this.broadcastToRoom(roomId, {
                        type: 'user_left',
                        userId: ws.userId
                    });
                }
            }
        }
    }
    
    joinRoom(ws, roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(ws.userId);
        
        ws.send(JSON.stringify({ type: 'joined_room', roomId }));
        this.broadcastToRoom(roomId, {
            type: 'user_joined',
            userId: ws.userId
        });
    }
    
    leaveRoom(ws, roomId) {
        if (this.rooms.has(roomId)) {
            this.rooms.get(roomId).delete(ws.userId);
            this.broadcastToRoom(roomId, {
                type: 'user_left',
                userId: ws.userId
            });
        }
    }
    
    broadcastToRoom(roomId, message) {
        if (!this.rooms.has(roomId)) return;
        
        const data = JSON.stringify(message);
        for (const userId of this.rooms.get(roomId)) {
            const ws = this.clients.get(userId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        }
    }
    
    broadcastAll(message) {
        const data = JSON.stringify(message);
        for (const ws of this.clients.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        }
    }
    
    // Send to specific user
    sendToUser(userId, message) {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    
    // Heartbeat
    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }
}

global.wsHandler = null;

module.exports = WebSocketHandler;
