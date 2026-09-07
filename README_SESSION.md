# Session Management Design for RDB Social Network

## 🏗 Architecture Overview

I've designed a **stateless JWT + Stateful Session Tracking** hybrid architecture that leverages PostgreSQL for session persistence while maintaining the scalability benefits of JWT tokens.

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATION                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Access Token │  │ Refresh Token│  │ Session ID   │     │
│  │ (15 min TTL) │  │ (7 day TTL)  │  │ (UUID)       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API GATEWAY/LOAD BALANCER                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS APPLICATION                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │              AUTH MIDDLEWARE                       │    │
│  │  1. Verify JWT Signature                          │    │
│  │  2. Check Session in PostgreSQL                    │    │
│  │  3. Validate User Status                           │    │
│  │  4. Update Last Used Timestamp                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     POSTGRESQL DATABASE                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Users     │  │   Sessions   │  │ Refresh Tokens│    │
│  │    Table     │  │    Table     │  │   (Indexed)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Design Goals

1. **Security**: Prevent token theft and replay attacks
2. **Scalability**: Support multiple concurrent sessions per user
3. **Revocability**: Immediate session termination capability
4. **Auditability**: Track session history and patterns
5. **User Experience**: Seamless token refresh without re-login

## 📊 Database Schema Design

### Core Sessions Table

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    user_agent TEXT,
    ip_address INET,
    device_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason VARCHAR(50)
);
```

### Key Design Decisions

1. **UUID Primary Keys**: Globally unique, no enumeration possible
2. **Token Storage**: Store both access and refresh tokens for validation
3. **Device Tracking**: Track user agent, IP, and device fingerprint
4. **Soft Delete**: Sessions are revoked, not deleted (audit trail)
5. **Indexed Lookups**: Optimized for token and user queries

## 🔄 Token Lifecycle

### 1. Authentication Flow

```
User Login → Verify Credentials → Generate Tokens → Create Session → Return Tokens
```

### 2. Token Refresh Flow

```
Client Request → Validate Refresh Token → Check Session → Rotate Tokens → Update Session
```

### 3. Session Revocation Flow

```
Revoke Request → Mark Session Inactive → Record Reason → Immediate Effect
```

## 🔐 Security Features

### 1. Token Rotation
```javascript
// Each refresh rotates both tokens
async function rotateTokens(oldRefreshToken) {
    // 1. Validate old token
    const session = await findByRefreshToken(oldRefreshToken);
    
    // 2. Generate new tokens
    const newTokens = generateTokenPair();
    
    // 3. Revoke old session
    await revokeSession(session.id, 'rotation');
    
    // 4. Create new session with new tokens
    await createSession(session.user_id, newTokens);
    
    return newTokens;
}
```

### 2. Session Validation
```javascript
async function validateRequest(accessToken) {
    // Multi-layer validation
    const decoded = verifyJWT(accessToken);
    const session = await findActiveSession(decoded.sessionId);
    const user = await findActiveUser(decoded.userId);
    
    return { decoded, session, user };
}
```

### 3. Concurrent Session Management
- **Default**: Allow multiple sessions (desktop, mobile, tablet)
- **Optional**: Limit concurrent sessions per user
- **Device Tracking**: Identify and manage sessions by device

## 📈 Scalability Considerations

### 1. Database Indexing Strategy

```sql
-- Primary lookups
CREATE INDEX idx_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at);
```

### 2. Connection Pooling
```javascript
const pool = new Pool({
    max: 20,           // Maximum connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
```

### 3. Caching Layer (Optional)
While we use PostgreSQL as the source of truth, we could add:
- **In-memory cache** (Node.js Map) for hot sessions
- **Read replicas** for session validation
- **Partitioning** by time for historical sessions

## 🔄 Session States

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  ACTIVE  │────▶│ REVOKED  │────▶│ EXPIRED  │
└──────────┘     └──────────┘     └──────────┘
      │               │                  │
      │               │                  │
      ▼               ▼                  ▼
  Valid Session   Manual Revoke    Automatic Expiry
```

### State Transitions
1. **Active → Revoked**: User logout or admin action
2. **Active → Expired**: Token TTL reached
3. **Revoked → Expired**: Cleanup process

## 🛡 Security Measures

### 1. Brute Force Protection
```javascript
// Track failed login attempts
const failedAttempts = await trackFailedLogin(userId, ipAddress);
if (failedAttempts > 5) {
    await lockAccount(userId, 15 * 60); // 15 minutes
}
```

### 2. Session Hijacking Detection
```javascript
// Detect suspicious session activity
async function detectAnomaly(session, request) {
    if (session.ip_address !== request.ip) {
        await flagSession(session.id, 'ip_change');
        await notifyUser(session.user_id, 'New device login detected');
    }
}
```

### 3. Token Theft Mitigation
- **Short-lived access tokens** (15 minutes)
- **Refresh token rotation** on every use
- **Device fingerprinting** for session validation
- **Immediate revocation** capability

## 📊 Monitoring & Analytics

### 1. Session Metrics
```sql
-- Active sessions per user
SELECT user_id, COUNT(*) as session_count
FROM user_sessions
WHERE is_active = TRUE
GROUP BY user_id;
```

### 2. Security Events
```sql
-- Suspicious activity tracking
CREATE TABLE session_events (
    id UUID PRIMARY KEY,
    session_id UUID,
    event_type VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP
);
```

## 🔧 Implementation Details

### Session Creation
```javascript
async function createSession(userId, metadata) {
    const tokens = generateTokens();
    const session = await insertSession({
        userId,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ip,
        expiresAt: calculateExpiry(7 * 24 * 60 * 60) // 7 days
    });
    return { tokens, sessionId: session.id };
}
```

### Session Validation
```javascript
async function validateSession(accessToken) {
    // Cache lookup (optional)
    const cached = cache.get(accessToken);
    if (cached) return cached;
    
    // Database lookup
    const session = await db.sessions.findOne({
        accessToken,
        isActive: true,
        expiresAt: { $gt: new Date() }
    });
    
    // Cache result
    cache.set(accessToken, session, 60); // 60 seconds
    
    return session;
}
```

## 🚀 Performance Optimizations

### 1. Batch Operations
```javascript
// Bulk revoke sessions
async function revokeAllUserSessions(userId) {
    await db.sessions.updateMany(
        { userId, isActive: true },
        { isActive: false, revokedAt: new Date() }
    );
}
```

### 2. Periodic Cleanup
```javascript
// Run every hour
cron.schedule('0 * * * *', async () => {
    await db.sessions.deleteMany({
        expiresAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
});
```

## 🎯 Trade-offs & Decisions

### Why PostgreSQL over Redis?

**Advantages:**
- ✅ No additional infrastructure
- ✅ ACID compliance
- ✅ Persistent storage
- ✅ SQL querying for analytics
- ✅ Foreign key constraints
- ✅ Backup/recovery built-in

**Disadvantages:**
- ❌ Slower than Redis (ms vs μs)
- ❌ More complex scaling
- ❌ Connection overhead

**Mitigation:**
- Connection pooling
- Proper indexing
- Optional in-memory cache layer
- Batch operations

### When to Consider Redis
- >1000 requests/second
- Need sub-millisecond latency
- Distributed session sharing
- High write throughput

## 🔮 Future Enhancements

1. **Device Trust Scoring**: Assign trust levels to devices
2. **Geographic Validation**: Flag logins from unusual locations
3. **Session Analytics**: User behavior analysis
4. **Rate Limiting Integration**: Tie sessions to rate limits
5. **OAuth Integration**: Third-party authentication
6. **WebSocket Sessions**: Real-time session updates

This session management design provides enterprise-grade security while maintaining scalability and user experience. The PostgreSQL-based approach offers simplicity and reliability without sacrificing security features.