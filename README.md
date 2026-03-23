# MRABT: The Lost Block - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "player1",
  "email": "player@example.com",
  "password": "SecurePass123"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "player@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Puzzles

### Start Puzzle (Basic)
```http
POST /puzzle/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "level": 1
}
```

### Submit Answer (Basic)
```http
POST /puzzle/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "puzzleId": "...",
  "answer": "CRYPTO"
}
```

### Get Progress
```http
GET /puzzle/progress
Authorization: Bearer <token>
```

---

## Zero-Knowledge Puzzles

### Start ZK Puzzle
```http
POST /zkpuzzle/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "level": 1
}
```

### Submit ZK Answer
```http
POST /zkpuzzle/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "puzzleId": "...",
  "answer": "...",
  "challengeId": "..."
}
```

---

## Meta Puzzles (Levels 21-30)

### Start Meta Puzzle
```http
POST /metapuzzle/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "level": 21
}
```

### Submit Meta Answer
```http
POST /metapuzzle/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "puzzleId": "...",
  "answer": "...",
  "params": {...}
}
```

---

## Payment

### Create Payment
```http
POST /payment/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 10,
  "currency": "USDT",
  "network": "TRC20"
}
```

### Verify Payment
```http
GET /payment/verify/:orderId
Authorization: Bearer <token>
```

---

## Encryption

### Generate Key Pair
```http
POST /encryption/generate-keypair
Authorization: Bearer <token>
```

### Sign Data
```http
POST /encryption/sign
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": {"message": "hello"},
  "privateKey": "-----BEGIN RSA PRIVATE KEY..."
}
```

---

## Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "security": "complete",
  "encryption": "enabled",
  "version": "3.0"
}
```

---

## WebSocket

Connect to: `ws://localhost:3000/ws`

### Messages

```json
// Authenticate
{"type": "auth", "userId": "..."}

// Join room
{"type": "join_room", "roomId": "level_21"}

// Puzzle update
{"type": "puzzle_update", "roomId": "level_21", "level": 21, "progress": 50}

// Chat
{"type": "chat", "roomId": "level_21", "text": "Need help!"}
```

---

## Error Responses

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common status codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
