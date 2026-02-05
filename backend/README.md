# YouTube Annotator Backend

Backend API for the YouTube Annotator Chrome extension, enabling users to share annotations via shareable links.

## Features

- Anonymous user authentication
- Create and share annotation sets
- Browse shares by video
- Manage personal shares (update, delete)
- Rate limiting and CORS protection
- PostgreSQL database with JSONB for flexible annotation storage

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/youtube_annotator
PORT=3000
NODE_ENV=development
CORS_ORIGINS=chrome-extension://your-extension-id
```

4. Create PostgreSQL database:
```bash
createdb youtube_annotator
```

5. Run migrations:
```bash
npm run migrate
```

6. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication

#### POST /api/auth/register
Register a new anonymous user.

**Response:**
```json
{
  "anonymousId": "abc123...",
  "userId": "uuid",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/auth/verify
Verify anonymous ID (requires `X-Anonymous-ID` header).

**Response:**
```json
{
  "valid": true,
  "userId": "uuid",
  "authType": "anonymous",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Shares

#### POST /api/shares
Create a new share (requires `X-Anonymous-ID` header).

**Request Body:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Great annotations",
  "annotations": [
    {
      "timestamp": 42,
      "text": "Important moment"
    }
  ],
  "isPublic": true
}
```

**Response:**
```json
{
  "shareToken": "a7f3k9p2",
  "shareUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ&share=a7f3k9p2",
  "videoId": "dQw4w9WgXcQ",
  "title": "Great annotations",
  "annotationCount": 1,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### GET /api/shares/:token
Get shared annotations by token (public endpoint).

**Response:**
```json
{
  "shareToken": "a7f3k9p2",
  "videoId": "dQw4w9WgXcQ",
  "title": "Great annotations",
  "annotations": [...],
  "viewCount": 42,
  "createdAt": "2024-01-01T00:00:00Z",
  "isOwner": false
}
```

#### GET /api/shares/video/:videoId
Browse shares for a video.

**Query Parameters:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)

**Response:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "shares": [...],
  "count": 10,
  "limit": 50,
  "offset": 0
}
```

#### GET /api/shares/me
List current user's shares (requires `X-Anonymous-ID` header).

**Response:**
```json
{
  "shares": [...],
  "count": 5,
  "limit": 50,
  "offset": 0
}
```

#### PUT /api/shares/:token
Update share (requires `X-Anonymous-ID` header and ownership).

**Request Body:**
```json
{
  "title": "Updated title",
  "annotations": [...],
  "isPublic": false
}
```

#### DELETE /api/shares/:token
Delete share (requires `X-Anonymous-ID` header and ownership).

**Response:**
```json
{
  "message": "Share deleted successfully",
  "shareToken": "a7f3k9p2"
}
```

## Database Schema

### users
- `id` (UUID) - Primary key
- `anonymous_id` (VARCHAR) - Unique identifier stored in extension
- `auth_type` (VARCHAR) - 'anonymous', 'email', 'google', 'youtube'
- `email`, `display_name` (VARCHAR) - For future auth types
- `created_at` (TIMESTAMP)

### shares
- `id` (UUID) - Primary key
- `share_token` (VARCHAR) - 8-character unique token
- `user_id` (UUID) - Foreign key to users
- `video_id` (VARCHAR) - YouTube video ID
- `title` (VARCHAR) - Optional title
- `annotations` (JSONB) - Array of annotation objects
- `is_public` (BOOLEAN) - Public visibility
- `view_count` (INTEGER) - View counter
- `created_at`, `updated_at` (TIMESTAMP)

## Security Features

- **CORS**: Only allows chrome-extension:// origins
- **Rate Limiting**:
  - 100 requests/minute per IP (general)
  - 10 shares/hour per IP (share creation)
- **Input Validation**:
  - Video IDs must match YouTube format
  - Max 100 annotations per share
  - Max 500 characters per annotation
  - Max 255 characters for titles
- **Authentication**: Anonymous ID verification
- **SQL Injection Protection**: Parameterized queries

## Deployment

### Railway/Render Deployment

1. Create a new project on Railway or Render
2. Add PostgreSQL database addon
3. Set environment variables:
   - `DATABASE_URL` (automatically set by database addon)
   - `NODE_ENV=production`
   - `CORS_ORIGINS=chrome-extension://your-extension-id`
4. Connect GitHub repository
5. Deploy from `backend` directory
6. Run migrations: `npm run migrate`

### Health Check

Test if the server is running:
```bash
curl http://localhost:3000/api/health
```

## Development

### Project Structure

```
backend/
├── migrations/          # SQL migration files
├── src/
│   ├── config/         # Database configuration
│   ├── middleware/     # Express middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── utils/          # Utility functions
│   ├── server.js       # Main Express app
│   └── migrate.js      # Migration runner
├── package.json
└── .env
```

### Testing

Test endpoints with curl:

```bash
# Register anonymous user
curl -X POST http://localhost:3000/api/auth/register

# Create share (replace ANONYMOUS_ID)
curl -X POST http://localhost:3000/api/shares \
  -H "Content-Type: application/json" \
  -H "X-Anonymous-ID: YOUR_ANONYMOUS_ID" \
  -d '{
    "videoId": "dQw4w9WgXcQ",
    "title": "Test share",
    "annotations": [{"timestamp": 42, "text": "Test annotation"}]
  }'

# Get share (replace TOKEN)
curl http://localhost:3000/api/shares/TOKEN
```

## Future Enhancements

See `PLAN.md` for planned features:
- YouTube OAuth integration
- Voting and rating system
- Video owner moderation
- Social features (profiles, following, comments)
- Full-text search
- Trending annotations

## License

MIT
