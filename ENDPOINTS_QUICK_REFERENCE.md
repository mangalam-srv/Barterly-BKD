# 🎯 Barterly Backend - Working Endpoints Quick Reference

## Base URL
```
http://localhost:4000
```

---

## 🔐 Authentication Endpoints

### 1. Register User
```http
POST /api/v1/users/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```
**Response:** `201 Created` + JWT token

---

### 2. Login User
```http
POST /api/v1/users/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```
**Response:** `200 OK` + JWT token

---

### 3. Google OAuth Login
```http
GET /auth/google
```
**Response:** Redirects to Google login screen

---

### 4. Logout User
```http
POST /api/v1/users/logout
Authorization: Bearer {token}
```
**Response:** `200 OK`

---

## 👤 User Profile Endpoints

### 5. Get Current User
```http
GET /api/v1/users/profile/me
Authorization: Bearer {token}
```
**Response:** `200 OK` - Current user data

---

### 6. Update User Profile
```http
PATCH /api/v1/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Jane Doe",
  "location": "New York"
}
```
**Response:** `200 OK` - Updated user data

---

## 📦 Item Listing Endpoints

### 7. Get All Items
```http
GET /api/v1/items?page=1&limit=10&listingType=Barter&search=camera
```
**Response:** `200 OK` - Items array + pagination

---

### 8. Get Item by ID
```http
GET /api/v1/items/{itemId}
```
**Response:** `200 OK` - Item details

---

### 9. Get User's Items
```http
GET /api/v1/items/user/{userId}?page=1&limit=10
```
**Response:** `200 OK` - User's items + pagination

---

### 10. Create Item Listing
```http
POST /api/v1/items/listitem
Authorization: Bearer {token}
Content-Type: multipart/form-data

Fields:
- title: "Vintage Camera"
- description: "High-quality vintage camera"
- listingType: "Barter"  (enum: Barter, Both, Rent)
- location: "New York"
- image: [file upload]
```
**Response:** `201 Created` - Created item

---

### 11. Update Item
```http
PUT /api/v1/items/{itemId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "listingType": "Both",
  "location": "Los Angeles"
}
```
**Response:** `200 OK` - Updated item

---

### 12. Delete Item
```http
DELETE /api/v1/items/{itemId}
Authorization: Bearer {token}
```
**Response:** `200 OK` - Confirmation

---

## 🤖 AI Integration Endpoint

### 13. Generate Listing Description
```http
POST /api/ai/generate-listing
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Vintage Camera",
  "description": "Old camera"
}
```
**Response:** `200 OK` - AI-generated description

---

## 💬 WebSocket Endpoints

### Connect to WebSocket
```javascript
ws = new WebSocket('ws://localhost:4000')

// Join a room
ws.send(JSON.stringify({
  event: 'join-room',
  data: 'room_id'
}))

// Send message
ws.send(JSON.stringify({
  event: 'send-message',
  data: {
    roomId: 'room_id',
    message: 'Hello!',
    sender: 'user_id'
  }
}))

// Listen for messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data)
}
```

---

## ✅ Health Check

### Server Status
```http
GET /health
```
**Response:** `200 OK` - Server running

---

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success - GET, PUT, DELETE |
| 201 | Created - POST new resource |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Need login |
| 403 | Forbidden - Not authorized |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error |
| 503 | Service Unavailable |

---

## 🔑 Getting JWT Token

After login or registration, you'll receive:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Use this token in Authorization header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Quick Test with cURL

### Register
```bash
curl -X POST http://localhost:4000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"pass123"}'
```

### Login
```bash
curl -X POST http://localhost:4000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"pass123"}'
```

### Get All Items
```bash
curl http://localhost:4000/api/v1/items
```

### Get Current User (with token)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/v1/users/profile/me
```

### Create Item
```bash
curl -X POST http://localhost:4000/api/v1/items/listitem \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Camera" \
  -F "description=Vintage camera" \
  -F "listingType=Barter" \
  -F "location=NYC" \
  -F "image=@/path/to/image.jpg"
```

---

## 🚀 Frontend Integration

### Example: Get Items
```javascript
const response = await fetch('http://localhost:4000/api/v1/items?page=1&limit=10')
const data = await response.json()
console.log(data.data.items)
```

### Example: Create Item with Auth
```javascript
const token = localStorage.getItem('token')
const formData = new FormData()
formData.append('title', 'Camera')
formData.append('description', 'Vintage camera')
formData.append('listingType', 'Barter')
formData.append('location', 'NYC')
formData.append('image', fileInput.files[0])

const response = await fetch('http://localhost:4000/api/v1/items/listitem', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
const data = await response.json()
```

### Example: Protected Route Check
```javascript
const token = localStorage.getItem('token')
if (!token) {
  // Redirect to login
} else {
  // Allow access
}
```

---

## 🔗 API Flow Diagram

```
User Registration/Login
         ↓
  Get JWT Token
         ↓
  Store in localStorage
         ↓
  Use in Authorization header
         ↓
  Access Protected Routes
```

---

## ✨ All Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | /api/v1/users/register | No | Register user |
| POST | /api/v1/users/login | No | Login user |
| POST | /api/v1/users/logout | Yes | Logout user |
| GET | /api/v1/users/profile/me | Yes | Get profile |
| PATCH | /api/v1/users/profile | Yes | Update profile |
| GET | /api/v1/items | No | Get all items |
| GET | /api/v1/items/:id | No | Get item detail |
| GET | /api/v1/items/user/:userId | No | Get user items |
| POST | /api/v1/items/listitem | Yes | Create item |
| PUT | /api/v1/items/:id | Yes | Update item |
| DELETE | /api/v1/items/:id | Yes | Delete item |
| POST | /api/ai/generate-listing | Yes | AI description |
| GET | /health | No | Health check |

---

## 🎯 Ready for Production

✅ 13 fully functional endpoints
✅ Comprehensive error handling
✅ Security best practices
✅ Input validation
✅ JWT authentication
✅ File upload security
✅ CORS configured
✅ WebSocket support
✅ Pagination & filtering
✅ AI integration ready

Start your backend: `npm run dev`
