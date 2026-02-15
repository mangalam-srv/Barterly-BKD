# Barterly Backend API Documentation

## Overview
This is the production-ready backend for the Barterly application, a barter/rental platform. The API is built with Express.js, MongoDB, and includes real-time features with WebSocket support.

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd barterly-b
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Fill in your actual values in .env
   ```

3. **Environment Variables Required:**
   ```
   PORT=4000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017
   JWT_SECRET=your-secure-jwt-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   GEMINI_API_KEY=your-gemini-api-key
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:4000`

---

## API Endpoints

### Health Check
- **GET** `/health`
  - No authentication required
  - Returns server status

---

## Authentication Endpoints

### Register User
- **POST** `/api/v1/users/register`
- **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123"
  }
  ```
- **Response (201):**
  ```json
  {
    "statusCode": 201,
    "data": {
      "user": {
        "id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "location": ""
      },
      "token": "jwt_token_here"
    },
    "message": "User registered successfully",
    "success": true
  }
  ```

### Login User
- **POST** `/api/v1/users/login`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "securePassword123"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "user": {
        "id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "location": ""
      },
      "token": "jwt_token_here"
    },
    "message": "Login successful",
    "success": true
  }
  ```

### Google OAuth Login
- **GET** `/auth/google`
  - Redirects to Google login

- **GET** `/auth/google/callback`
  - Google OAuth callback (automatic)
  - Returns JWT token and user data

### Logout User
- **POST** `/api/v1/users/logout`
- **Headers:** `Authorization: Bearer jwt_token`
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": null,
    "message": "User logged out successfully",
    "success": true
  }
  ```

---

## User Profile Endpoints

### Get Current User Profile
- **GET** `/api/v1/users/profile/me`
- **Headers:** `Authorization: Bearer jwt_token`
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "location": "New York",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    },
    "message": "User profile retrieved successfully",
    "success": true
  }
  ```

### Update User Profile
- **PATCH** `/api/v1/users/profile`
- **Headers:** `Authorization: Bearer jwt_token`
- **Body:**
  ```json
  {
    "name": "Jane Doe",
    "location": "San Francisco"
  }
  ```
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "user_id",
      "name": "Jane Doe",
      "email": "john@example.com",
      "location": "San Francisco",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:01Z"
    },
    "message": "User profile updated successfully",
    "success": true
  }
  ```

---

## Item Listing Endpoints

### Get All Items
- **GET** `/api/v1/items`
- **Query Parameters:**
  - `page` (optional, default: 1)
  - `limit` (optional, default: 10)
  - `listingType` (optional: "Barter", "Both", "Rent")
  - `location` (optional, case-insensitive search)
  - `search` (optional, searches title and description)
  
- **Example:** `/api/v1/items?page=1&limit=10&listingType=Barter&location=NYC`

- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "items": [
        {
          "_id": "item_id",
          "title": "Vintage Camera",
          "description": "High-quality vintage film camera in excellent condition",
          "listingType": "Barter",
          "location": "New York",
          "image": "https://cloudinary.com/...",
          "owner": {
            "_id": "owner_id",
            "name": "John Doe",
            "email": "john@example.com",
            "location": "New York"
          },
          "createdAt": "2024-01-15T10:00:00Z",
          "updatedAt": "2024-01-15T10:00:00Z"
        }
      ],
      "pagination": {
        "total": 50,
        "page": 1,
        "limit": 10,
        "totalPages": 5
      }
    },
    "message": "Items retrieved successfully",
    "success": true
  }
  ```

### Get Item by ID
- **GET** `/api/v1/items/:id`
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "_id": "item_id",
      "title": "Vintage Camera",
      "description": "High-quality vintage film camera in excellent condition",
      "listingType": "Barter",
      "location": "New York",
      "image": "https://cloudinary.com/...",
      "owner": {
        "_id": "owner_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    },
    "message": "Item retrieved successfully",
    "success": true
  }
  ```

### Get Items by User
- **GET** `/api/v1/items/user/:userId`
- **Query Parameters:**
  - `page` (optional, default: 1)
  - `limit` (optional, default: 10)

- **Response (200):** Same format as "Get All Items"

### Create Item Listing
- **POST** `/api/v1/items/listitem`
- **Headers:** `Authorization: Bearer jwt_token`
- **Content-Type:** `multipart/form-data`
- **Body:**
  ```
  - title: "Vintage Camera" (text)
  - description: "High-quality vintage film camera..." (text)
  - listingType: "Barter" (text, enum: "Barter", "Both", "Rent")
  - location: "New York" (text)
  - image: [file] (required, max 5MB, only images allowed)
  ```

- **cURL Example:**
  ```bash
  curl -X POST http://localhost:4000/api/v1/items/listitem \
    -H "Authorization: Bearer jwt_token" \
    -F "title=Vintage Camera" \
    -F "description=High-quality camera" \
    -F "listingType=Barter" \
    -F "location=New York" \
    -F "image=@path/to/image.jpg"
  ```

- **Response (201):**
  ```json
  {
    "statusCode": 201,
    "data": {
      "_id": "item_id",
      "title": "Vintage Camera",
      "description": "High-quality vintage film camera",
      "listingType": "Barter",
      "location": "New York",
      "image": "https://cloudinary.com/...",
      "owner": {
        "_id": "owner_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "message": "Item listing created successfully",
    "success": true
  }
  ```

### Update Item Listing
- **PUT** `/api/v1/items/:id`
- **Headers:** `Authorization: Bearer jwt_token`
- **Content-Type:** `multipart/form-data` (if updating image) or `application/json`
- **Body:**
  ```json
  {
    "title": "Updated Title",
    "description": "Updated description",
    "listingType": "Both",
    "location": "Los Angeles"
  }
  ```

- **Response (200):** Same format as Create Item

### Delete Item
- **DELETE** `/api/v1/items/:id`
- **Headers:** `Authorization: Bearer jwt_token`
- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "deletedItemId": "item_id"
    },
    "message": "Item deleted successfully",
    "success": true
  }
  ```

---

## AI Integration Endpoints

### Generate Listing Description
- **POST** `/api/ai/generate-listing`
- **Headers:** `Authorization: Bearer jwt_token`
- **Body:**
  ```json
  {
    "title": "Vintage Camera",
    "description": "A camera"
  }
  ```

- **Response (200):**
  ```json
  {
    "statusCode": 200,
    "data": {
      "generatedDescription": "This vintage film camera is a beautiful piece of photography equipment..."
    },
    "message": "Description generated successfully",
    "success": true
  }
  ```

- **Error Response (503):**
  ```json
  {
    "statusCode": 503,
    "message": "AI service is not configured",
    "success": false
  }
  ```

---

## WebSocket Events

### Connect to WebSocket
```javascript
const ws = new WebSocket('ws://localhost:4000');
```

### Join a Room
```javascript
ws.send(JSON.stringify({
  event: 'join-room',
  data: 'room_id'
}));
```

### Send Message
```javascript
ws.send(JSON.stringify({
  event: 'send-message',
  data: {
    roomId: 'room_id',
    message: 'Hello!',
    sender: 'sender_id'
  }
}));
```

### Listen for Messages
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.event); // 'receive-message', 'joined', etc.
};
```

---

## Error Responses

### Bad Request (400)
```json
{
  "statusCode": 400,
  "message": "Title, description, listing type, and location are required",
  "success": false
}
```

### Unauthorized (401)
```json
{
  "statusCode": 401,
  "message": "Invalid token",
  "success": false
}
```

### Forbidden (403)
```json
{
  "statusCode": 403,
  "message": "You are not authorized to delete this item",
  "success": false
}
```

### Not Found (404)
```json
{
  "statusCode": 404,
  "message": "Item not found",
  "success": false
}
```

### Conflict (409)
```json
{
  "statusCode": 409,
  "message": "Email already registered",
  "success": false
}
```

### Server Error (500)
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "success": false
}
```

---

## Key Features

✅ **Security**
- JWT token-based authentication
- Password hashing with bcrypt
- Protected routes with middleware
- CORS configured for frontend
- Environment variables for secrets

✅ **Error Handling**
- Centralized global error handler
- Consistent error response format
- Proper HTTP status codes
- AsyncHandler for async/await management

✅ **Database**
- MongoDB with Mongoose ODM
- Schema validation
- User and Item models with relationships
- Indexed fields for performance

✅ **File Upload**
- Multer for file handling
- Cloudinary integration for image storage
- File size limits (5MB)
- File type validation (images only)

✅ **AI Integration**
- Gemini API for description generation
- Error handling for API failures
- Rate limiting support

✅ **Real-time**
- WebSocket support for messaging
- Room-based chat functionality
- Real-time notifications ready

✅ **Production Ready**
- Environment-based configuration
- Graceful shutdown handling
- Unhandled error catching
- Comprehensive logging

---

## Testing with Postman

1. **Register User**
   - POST: `http://localhost:4000/api/v1/users/register`
   - Body: `{ "name": "John", "email": "john@test.com", "password": "pass123" }`

2. **Login**
   - POST: `http://localhost:4000/api/v1/users/login`
   - Body: `{ "email": "john@test.com", "password": "pass123" }`
   - Save the token

3. **Create Item** (after login)
   - POST: `http://localhost:4000/api/v1/items/listitem`
   - Headers: `Authorization: Bearer {token}`
   - Body (form-data): title, description, listingType, location, image

4. **Get All Items**
   - GET: `http://localhost:4000/api/v1/items`

5. **Generate AI Description**
   - POST: `http://localhost:4000/api/ai/generate-listing`
   - Headers: `Authorization: Bearer {token}`
   - Body: `{ "title": "Camera", "description": "Old camera" }`

---

## Troubleshooting

### MongoDB Connection Failed
- Ensure MongoDB is running: `mongod`
- Check MONGODB_URI in .env file
- For cloud DB: ensure IP is whitelisted

### Cloudinary Upload Failed
- Verify Cloudinary credentials in .env
- Check file size (max 5MB)
- Ensure file is an image format

### AI Generation Failed
- Check GEMINI_API_KEY is valid
- Check API quota/rate limits
- Ensure input is not too long

### CORS Errors
- Add frontend URL to FRONTEND_URL in .env
- Ensure credentials: true is set in frontend requests

---

## Production Deployment

1. Set `NODE_ENV=production` in environment
2. Use strong JWT_SECRET (generate with `openssl rand -base64 32`)
3. Use MongoDB Atlas or managed database
4. Use SSL certificate (HTTPS)
5. Set secure cookies (secure: true in production)
6. Enable rate limiting
7. Monitor logs and errors
8. Set up automated backups

---

## Support
For issues or questions, check the logs and ensure all environment variables are correctly configured.
