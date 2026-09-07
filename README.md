# RDB - Reddit-like Social Network API

A full-featured social network API inspired by Reddit, built with Node.js, Express, PostgreSQL, and Argon2 password hashing. This application provides a robust backend for creating communities, sharing posts, engaging in discussions through nested comments, and voting on content.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### User Management
- User registration with username and email
- Secure password hashing using Argon2id
- JWT-based authentication
- User profiles with avatars and bios
- User karma tracking
- Account activation/deactivation

### Communities
- Create and manage communities (subreddits)
- Join and leave communities
- Community roles (member, moderator, admin)
- Community search and discovery
- Member counting and management

### Posts
- Multiple post types (text, link, image, video)
- Post creation, editing, and deletion
- Community-specific posts
- Global feed with sorting options
- Post search functionality

### Comments
- Nested comment threads
- Reply to comments (unlimited depth)
- Comment editing and deletion
- Comment sorting algorithms (best, top, new, controversial)

### Voting System
- Upvote and downvote posts
- Upvote and downvote comments
- Real-time vote count updates
- User vote tracking
- Score calculation

### Additional Features
- Advanced search capabilities
- Pagination for all list endpoints
- Rate limiting (configurable)
- CORS support
- Request logging
- Error handling middleware
- Input validation and sanitization

## 🛠 Tech Stack

- **Runtime**: Node.js (v14 or higher)
- **Framework**: Express.js (v4.x)
- **Database**: PostgreSQL (v12 or higher)
- **Password Hashing**: Argon2 (argon2id variant)
- **Authentication**: JSON Web Tokens (JWT)
- **Validation**: express-validator
- **Security**: Helmet, CORS
- **Logging**: Morgan
- **Environment**: dotenv

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher) or **yarn**
- **PostgreSQL** (v12.0 or higher)
- **Git** (optional, for cloning)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/rdb-social-network.git
cd rdb-social-network
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rdb
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3001
```

### 4. Database Setup

#### Option A: Using npm Scripts

```bash
# Create database and tables
npm run db:init

# Or reset existing database (WARNING: This will delete all data)
npm run db:reset
```

#### Option B: Manual Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Run the schema file
\i database/schema.sql
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Verify Installation

The server should start and display:

```
Server running in development mode on port 3000
API available at http://localhost:3000/api
Successfully connected to PostgreSQL
```

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "success": true,
  "message": "Ripples API is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com"
    }
  }
}
```

### Community Endpoints

#### Create Community

```http
POST /api/communities
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "programming",
  "description": "All about programming"
}
```

#### Get All Communities

```http
GET /api/communities?limit=20&offset=0
```

#### Join Community

```http
POST /api/communities/:id/join
Authorization: Bearer <access_token>
```

### Post Endpoints

#### Create Post

```http
POST /api/posts
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "communityId": "uuid",
  "title": "Getting Started with Node.js",
  "content": "Node.js is amazing...",
  "type": "text"
}
```

#### Get Feed

```http
GET /api/posts?sortBy=hot&limit=20&offset=0
Authorization: Bearer <access_token> (optional)
```

**Sort Options:**
- `hot` - Trending posts
- `new` - Latest posts
- `top` - Highest voted posts
- `controversial` - Most controversial posts

### Comment Endpoints

#### Create Comment

```http
POST /api/comments
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "postId": "uuid",
  "content": "Great post!"
}
```

#### Reply to Comment

```http
POST /api/comments
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "postId": "uuid",
  "parentCommentId": "uuid",
  "content": "I agree with this!"
}
```

### Vote Endpoints

#### Vote on Post

```http
POST /api/votes
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "postId": "uuid",
  "voteType": 1  // 1 for upvote, -1 for downvote
}
```

#### Remove Vote

```http
DELETE /api/votes
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "postId": "uuid"
}
```

## 📁 Project Structure

```
rdb-social-network/
├── src/
│   ├── config/
│   │   └── database.js          # Database connection pool
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── communityController.js # Community management
│   │   ├── postController.js    # Post operations
│   │   ├── commentController.js  # Comment operations
│   │   └── voteController.js    # Voting logic
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── validation.js        # Input validation
│   │   └── errorHandler.js      # Error handling
│   ├── models/
│   │   ├── userModel.js         # User database operations
│   │   ├── communityModel.js    # Community database operations
│   │   ├── postModel.js         # Post database operations
│   │   ├── commentModel.js      # Comment database operations
│   │   └── voteModel.js         # Vote database operations
│   ├── routes/
│   │   ├── authRoutes.js        # Auth routes
│   │   ├── communityRoutes.js   # Community routes
│   │   ├── postRoutes.js        # Post routes
│   │   ├── commentRoutes.js     # Comment routes
│   │   ├── voteRoutes.js        # Vote routes
│   │   └── index.js             # Route aggregator
│   ├── utils/
│   │   ├── passwordUtils.js     # Argon2 password utilities
│   │   └── jwtUtils.js          # JWT token utilities
│   └── app.js                   # Express app setup
├── database/
│   └── schema.sql               # Database schema
├── tests/
│   └── api-tests.http           # REST Client test file
├── .env                         # Environment variables
├── .gitignore
├── package.json
├── server.js                    # Server entry point
└── README.md
```

## 🧪 Testing

### REST Client Tests

1. Install REST Client extension for VS Code
2. Open `tests/api-tests.http`
3. Click "Send Request" on any endpoint
4. Follow the complete workflow tests for full testing

### Manual Testing

```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!","confirmPassword":"Test123!"}'

# Test login (save the token)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Use token for protected routes
curl -X POST http://localhost:3000/api/communities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"test","description":"Test community"}'
```

## 🔒 Security

### Password Security
- **Argon2id** hashing with 64MB memory cost
- 3 iterations and 4-way parallelism
- Automatic password rehashing check
- Password strength validation

### API Security
- JWT tokens with 15-minute expiration
- Refresh tokens with 7-day expiration
- CORS protection
- Helmet security headers
- Rate limiting
- Input validation and sanitization

### Database Security
- Parameterized queries (SQL injection prevention)
- Foreign key constraints
- Unique constraints on email and username
- Database connection pooling

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Coding Standards
- Use ES6+ features
- Follow async/await patterns
- Add JSDoc comments for functions
- Write meaningful commit messages
- Include tests for new features

## 📝 License

This project is licensed under the GNU GENERAL PUBLIC LICENSE - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Argon2](https://github.com/P-H-C/phc-winner-argon2) - Password hashing
- [JSON Web Tokens](https://jwt.io/) - Authentication
- [Helmet](https://helmetjs.github.io/) - Security middleware

## 📞 Support

For support, create an issue in the GitHub repository.

## 🚀 Roadmap

- [ ] User notifications
- [ ] Moderation tools
- [ ] Media upload support
- [ ] User mentions
- [ ] Awards/rewards system
- [ ] Real-time updates (WebSockets)
- [ ] Email verification
- [ ] Password reset
- [ ] OAuth integration
- [ ] Mobile app API optimization

---

Built with ❤️ by asyong