# Tasks API Documentation

## Overview
The Tasks API allows users to manage their personal tasks. All tasks are user-specific - users can only view and manage their own tasks.

**Base URL:** `http://localhost:4000/api`

**Authentication:** All endpoints require JWT authentication via Bearer token in the Authorization header.

---

## Authentication

All requests must include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Create Task

Create a new task for the logged-in user.

**Endpoint:** `POST /tasks`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Inspect roof leakage",
  "description": "Check the roof for any leaks after the storm",
  "property": "property-id-123",
  "priority": "High",
  "dueDate": "2025-12-31T00:00:00.000Z",
  "isCompleted": false,
  "attachments": []
}
```

**Field Descriptions:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| title | string | Yes | Task title | "Inspect roof leakage" |
| description | string | No | Detailed description | "Check the roof for any leaks" |
| property | string | Yes | Property ID | "property-id-123" |
| priority | enum | No | Task priority: "Low", "Medium", "High" | "High" |
| dueDate | ISO date | No | Due date | "2025-12-31T00:00:00.000Z" |
| isCompleted | boolean | No | Completion status | false |
| attachments | array | No | Array of attachment objects | [] |

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Task created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Inspect roof leakage",
    "description": "Check the roof for any leaks after the storm",
    "userId": "user-id-123",
    "ownerName": "John Doe",
    "property": "property-id-123",
    "priority": "High",
    "dueDate": "2025-12-31T00:00:00.000Z",
    "isCompleted": false,
    "completedAt": null,
    "completedBy": null,
    "attachments": [],
    "createdAt": "2026-03-19T10:30:00.000Z",
    "updatedAt": "2026-03-19T10:30:00.000Z"
  }
}
```

**Notes:**
- `ownerName` is automatically set from the logged-in user (do NOT send in request)
- `userId` is automatically set from the logged-in user
- Task is automatically assigned to the logged-in user

---

### 2. Get All Tasks

Retrieve all tasks for the logged-in user with pagination and filtering.

**Endpoint:** `GET /tasks`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| page | number | No | Page number (default: 1) | 1 |
| limit | number | No | Items per page (default: 10) | 20 |
| search | string | No | Search in title/description | "roof" |
| property | string | No | Filter by property ID | "property-id-123" |
| priority | enum | No | Filter by priority: "Low", "Medium", "High" | "High" |
| isCompleted | boolean | No | Filter by completion status | true |
| ownerName | string | No | Filter by owner name | "John" |

**Example Request:**
```
GET /tasks?page=1&limit=10&priority=High&isCompleted=false
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Tasks retrieved successfully",
  "data": {
    "data": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Inspect roof leakage",
        "description": "Check the roof for any leaks",
        "userId": "user-id-123",
        "ownerName": "John Doe",
        "property": "property-id-123",
        "priority": "High",
        "dueDate": "2025-12-31T00:00:00.000Z",
        "isCompleted": false,
        "completedAt": null,
        "completedBy": null,
        "attachments": [],
        "createdAt": "2026-03-19T10:30:00.000Z",
        "updatedAt": "2026-03-19T10:30:00.000Z"
      }
    ],
    "meta": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "pages": 3
    }
  }
}
```

**Notes:**
- Only returns tasks belonging to the logged-in user
- Results are sorted by creation date (newest first)

---

### 3. Get Single Task

Retrieve a specific task by ID.

**Endpoint:** `GET /tasks/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Example Request:**
```
GET /tasks/507f1f77bcf86cd799439011
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Task retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Inspect roof leakage",
    "description": "Check the roof for any leaks",
    "userId": "user-id-123",
    "ownerName": "John Doe",
    "property": "property-id-123",
    "priority": "High",
    "dueDate": "2025-12-31T00:00:00.000Z",
    "isCompleted": false,
    "completedAt": null,
    "completedBy": null,
    "attachments": [
      {
        "key": "tasks/507f1f77bcf86cd799439011/file-123.jpg",
        "name": "roof-photo.jpg",
        "type": "image/jpeg",
        "size": 245678,
        "url": "https://s3.amazonaws.com/signed-url..."
      }
    ],
    "createdAt": "2026-03-19T10:30:00.000Z",
    "updatedAt": "2026-03-19T10:30:00.000Z"
  }
}
```

**Error Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Task not found"
}
```

**Notes:**
- Returns 404 if task doesn't exist or doesn't belong to the user
- Attachment URLs are pre-signed and valid for 1 hour

---

### 4. Update Task

Update a specific task.

**Endpoint:** `PATCH /tasks/:id`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Request Body:** (All fields are optional)
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "priority": "Medium",
  "dueDate": "2026-01-15T00:00:00.000Z",
  "isCompleted": true
}
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Task updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Updated title",
    "description": "Updated description",
    "userId": "user-id-123",
    "ownerName": "John Doe",
    "property": "property-id-123",
    "priority": "Medium",
    "dueDate": "2026-01-15T00:00:00.000Z",
    "isCompleted": true,
    "completedAt": "2026-03-19T11:00:00.000Z",
    "completedBy": "user-id-123",
    "attachments": [],
    "createdAt": "2026-03-19T10:30:00.000Z",
    "updatedAt": "2026-03-19T11:00:00.000Z"
  }
}
```

**Error Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Task not found"
}
```

**Notes:**
- Only the task owner can update the task
- When `isCompleted` is set to `true`, `completedAt` and `completedBy` are automatically set
- When `isCompleted` is set to `false`, `completedAt` and `completedBy` are cleared

---

### 5. Delete Task

Delete a specific task.

**Endpoint:** `DELETE /tasks/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Example Request:**
```
DELETE /tasks/507f1f77bcf86cd799439011
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Task deleted successfully"
}
```

**Error Response:** `404 Not Found`
```json
{
  "statusCode": 404,
  "message": "Task not found"
}
```

**Notes:**
- Only the task owner can delete the task
- Deletion is permanent and cannot be undone

---

### 6. Toggle Task Status

Toggle the completion status of a task (completed ↔ not completed).

**Endpoint:** `POST /tasks/:id/toggle-status`

**Headers:**
```
Authorization: Bearer <token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Example Request:**
```
POST /tasks/507f1f77bcf86cd799439011/toggle-status
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Task status toggled successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Inspect roof leakage",
    "isCompleted": true,
    "completedAt": "2026-03-19T11:00:00.000Z",
    "completedBy": "user-id-123",
    "updatedAt": "2026-03-19T11:00:00.000Z"
  }
}
```

**Notes:**
- If task is completed, it becomes not completed (and vice versa)
- Automatically updates `completedAt` and `completedBy` fields

---

### 7. Bulk Update Task Status

Update the completion status of multiple tasks at once.

**Endpoint:** `PATCH /tasks/bulk-status-update`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "ids": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ],
  "isCompleted": true
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ids | array | Yes | Array of task IDs to update |
| isCompleted | boolean | Yes | New completion status |

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Tasks updated successfully",
  "data": {
    "acknowledged": true,
    "modifiedCount": 3,
    "upsertedId": null,
    "upsertedCount": 0,
    "matchedCount": 3
  }
}
```

**Notes:**
- Only updates tasks that belong to the logged-in user
- Invalid task IDs are ignored
- Tasks not belonging to the user are not updated

---

### 8. Get Upload URL for Attachment

Generate a pre-signed URL to upload a file attachment.

**Endpoint:** `POST /tasks/:id/attachments/upload-url`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Task ID |

**Request Body:**
```json
{
  "contentType": "image/jpeg"
}
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Upload URL generated successfully",
  "data": {
    "key": "tasks/507f1f77bcf86cd799439011/abc-123.jpg",
    "url": "https://s3.amazonaws.com/bucket/tasks/507f1f77bcf86cd799439011/abc-123.jpg?X-Amz-Algorithm=..."
  }
}
```

**Upload Flow:**

1. **Get upload URL:**
```javascript
const response = await fetch('/tasks/507f1f77bcf86cd799439011/attachments/upload-url', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ contentType: 'image/jpeg' })
});
const { key, url } = response.data;
```

2. **Upload file to S3:**
```javascript
await fetch(url, {
  method: 'PUT',
  headers: {
    'Content-Type': 'image/jpeg'
  },
  body: fileBlob
});
```

3. **Update task with attachment info:**
```javascript
await fetch('/tasks/507f1f77bcf86cd799439011', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    attachments: [
      {
        key: key,
        name: 'roof-photo.jpg',
        type: 'image/jpeg',
        size: 245678
      }
    ]
  })
});
```

**Supported Content Types:**
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Spreadsheets: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Other: `text/plain`, `application/zip`

---

### 9. Get Download URL for Attachment

Generate a pre-signed URL to download a file attachment.

**Endpoint:** `GET /tasks/attachments/download-url`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| key | string | Yes | File key from attachment object |

**Example Request:**
```
GET /tasks/attachments/download-url?key=tasks/507f1f77bcf86cd799439011/abc-123.jpg
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Download URL generated successfully",
  "data": {
    "url": "https://s3.amazonaws.com/bucket/tasks/507f1f77bcf86cd799439011/abc-123.jpg?X-Amz-Algorithm=..."
  }
}
```

**Notes:**
- URL is valid for 1 hour
- Use this URL to download or display the file

---

## Data Models

### Task Object

```typescript
{
  _id: string;                    // Unique task ID
  title: string;                  // Task title
  description?: string;           // Task description (optional)
  userId: string;                 // Owner user ID (auto-set)
  ownerName: string;              // Owner name (auto-set)
  property: string;               // Property ID
  priority: "Low" | "Medium" | "High";  // Task priority
  dueDate?: Date;                 // Due date (optional)
  isCompleted: boolean;           // Completion status
  completedAt?: Date;             // Completion timestamp (auto-set)
  completedBy?: string;           // User who completed (auto-set)
  attachments: Attachment[];      // Array of attachments
  createdAt: Date;                // Creation timestamp
  updatedAt: Date;                // Last update timestamp
}
```

### Attachment Object

```typescript
{
  key: string;      // S3 file key
  name: string;     // Original filename
  type: string;     // MIME type
  size: number;     // File size in bytes
  url?: string;     // Pre-signed download URL (only in responses)
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "title should not be empty"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Task not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Important Notes for Frontend

### 1. User Isolation
- All tasks are user-specific
- Users can only see and manage their own tasks
- Attempting to access another user's task returns 404

### 2. Automatic Fields
- **DO NOT** send `ownerName` in create request (auto-set from logged-in user)
- **DO NOT** send `userId` (auto-set from JWT token)
- **DO NOT** manually set `completedAt` or `completedBy` (auto-set when `isCompleted` changes)

### 3. Authentication
- All endpoints require JWT token
- Token must be included in `Authorization: Bearer <token>` header
- Token expiration should be handled with refresh token flow

### 4. Pagination
- Default page size is 10
- Maximum page size is 100
- Use `meta` object to build pagination UI

### 5. File Uploads
- Use the 3-step upload flow (get URL → upload to S3 → update task)
- Pre-signed URLs expire after 15 minutes
- Maximum file size: 10MB (configurable)

### 6. Date Handling
- All dates are in ISO 8601 format
- Dates are stored in UTC
- Convert to local timezone in frontend

### 7. Search & Filters
- Search is case-insensitive
- Multiple filters can be combined
- Empty filters are ignored

---

## Example Frontend Integration

### React Example

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

// Create axios instance with auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to all requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Get all tasks
export const getTasks = async (params) => {
  const response = await api.get('/tasks', { params });
  return response.data;
};

// Create task
export const createTask = async (taskData) => {
  const response = await api.post('/tasks', taskData);
  return response.data;
};

// Update task
export const updateTask = async (id, taskData) => {
  const response = await api.patch(`/tasks/${id}`, taskData);
  return response.data;
};

// Delete task
export const deleteTask = async (id) => {
  const response = await api.delete(`/tasks/${id}`);
  return response.data;
};

// Toggle task status
export const toggleTaskStatus = async (id) => {
  const response = await api.post(`/tasks/${id}/toggle-status`);
  return response.data;
};

// Upload attachment
export const uploadAttachment = async (taskId, file) => {
  // Step 1: Get upload URL
  const { data: { key, url } } = await api.post(
    `/tasks/${taskId}/attachments/upload-url`,
    { contentType: file.type }
  );

  // Step 2: Upload to S3
  await axios.put(url, file, {
    headers: { 'Content-Type': file.type }
  });

  // Step 3: Return attachment info
  return {
    key,
    name: file.name,
    type: file.type,
    size: file.size
  };
};
```

---

## Testing

### Postman Collection

Import this collection to test all endpoints:

```json
{
  "info": {
    "name": "Tasks API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:4000/api"
    },
    {
      "key": "token",
      "value": "your-jwt-token-here"
    }
  ]
}
```

---

## Support

For questions or issues, contact:
- Backend Team: backend@example.com
- API Documentation: http://localhost:4000/api-docs (Swagger)

---

**Last Updated:** March 19, 2026
**API Version:** 1.0.0
