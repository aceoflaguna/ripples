A common authentication system uses **two tokens**:

* **Access token** — short-lived, used to access protected APIs.
* **Refresh token** — long-lived, used to obtain a new access token.

Think of it like this:

```text
                LOGIN
                  │
                  ▼
        ┌─────────────────────┐
        │      Server         │
        │ validates username  │
        │ + password          │
        └──────────┬──────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   Access Token       Refresh Token
   short lifetime     long lifetime
   e.g. 15 minutes    e.g. 30 days
          │                 │
          ▼                 │
       API calls            │
                            │
                            ▼
                       /auth/refresh
                            │
                            ▼
                    New Access Token
```

## 1. User logs in

The client sends:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

The server verifies the credentials.

Then it creates:

```text
Access Token
Refresh Token
```

For example:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "abc123..."
}
```

---

## 2. Access token is used for API requests

The client sends the access token:

```http
GET /api/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Your Express middleware verifies it:

```js
const token = req.headers.authorization?.split(" ")[1];

const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
```

If valid:

```text
Request → Middleware → API endpoint
```

If expired:

```text
Request → Middleware → 401 Unauthorized
```

The important point is that **you don't normally use the refresh token for every API request**.

---

# 3. Access token expires

Suppose your access token lasts:

```text
15 minutes
```

After 15 minutes:

```text
Access Token
     ↓
   EXPIRED
```

The user doesn't necessarily need to log in again.

The client sends the refresh token to:

```http
POST /auth/refresh
```

For example:

```json
{
  "refreshToken": "abc123..."
}
```

---

# 4. Server validates the refresh token

This is where your `user_sessions` table becomes important.

You might have something like:

```text
user_sessions
------------------------------------------------
id
user_id
refresh_token_hash
expires_at
revoked_at
revocation_reason
created_at
```

The server finds the refresh token/session and checks:

```text
Does it exist?
       ↓
Is it expired?
       ↓
Is it revoked?
       ↓
Does it belong to the user?
       ↓
Is it otherwise valid?
```

If everything is okay, the server issues a new access token.

---

# 5. Refresh-token rotation

This relates directly to your previous question about:

```text
token_rotation
```

A more secure system uses **refresh token rotation**.

Suppose the user initially has:

```text
Refresh Token A
```

They call:

```http
POST /auth/refresh
```

The server does:

```text
Refresh Token A
       │
       ▼
   validate
       │
       ▼
     revoke A
       │
       │ revocation_reason =
       │ "token_rotation"
       ▼
Create Refresh Token B
       │
       ▼
Return:
   Access Token B
   Refresh Token B
```

So:

```text
A → B → C → D → E
```

Each refresh token is used once and replaced by another.

Your database could look like:

```text
id    token       revoked_at    reason
------------------------------------------------
1     A           10:00         token_rotation
2     B           11:00         token_rotation
3     C           12:00         token_rotation
4     D           NULL          NULL
```

The currently active refresh token is `D`.

---

# 6. Why rotate refresh tokens?

Imagine someone steals:

```text
Refresh Token A
```

Normally, they might be able to continuously use it to obtain new access tokens.

With rotation:

```text
User                    Attacker
 │                         │
 │ uses A                  │
 ▼                         │
Server                     │
 │                         │
 ├── revoke A              │
 ├── create B              │
 │                         │
 ▼                         ▼
User gets B             tries A
                           │
                           ▼
                       A is revoked
                           │
                           ▼
                       REJECT
```

This makes stolen refresh tokens much less useful.

---

# 7. An even better security feature: reuse detection

With rotation, you can detect something suspicious.

For example:

```text
A → B
```

The legitimate user now has `B`.

But an attacker somehow has the old `A` and tries:

```text
Attacker → A → /auth/refresh
```

The server sees:

```text
A is already revoked
revocation_reason = token_rotation
```

That can indicate **refresh-token reuse/theft**.

You can then revoke the entire session/token family:

```text
A ── revoked
B ── revoked
C ── revoked
```

and force the user to log in again.

---

# 8. Access token vs refresh token

|                       | Access Token     | Refresh Token   |
| --------------------- | ---------------- | --------------- |
| Purpose               | Access APIs      | Get new tokens  |
| Lifetime              | Short            | Long            |
| Sent frequently       | Yes              | No              |
| Sent to API endpoints | Yes              | Usually no      |
| Can be JWT            | Yes              | Can be          |
| Stored in DB          | Usually no       | Usually tracked |
| Rotation              | Usually no       | Recommended     |
| If stolen             | Limited lifetime | More serious    |

---

# 9. Recommended architecture for your Express app

Since you're using Express + PostgreSQL + `user_sessions`, I'd structure it roughly like:

```text
LOGIN
 │
 ├── Create access token
 │       └── expires in 15 min
 │
 └── Create refresh token
         └── expires in 30 days
         └── store HASH in user_sessions
```

Then:

```text
API REQUEST
 │
 └── Authorization: Bearer ACCESS_TOKEN
             │
             ▼
        verify JWT
             │
       ┌─────┴─────┐
     valid       expired
       │             │
       ▼             ▼
    API        /auth/refresh
```

Refresh:

```text
REFRESH TOKEN
      │
      ▼
Find session
      │
      ▼
Validate
      │
      ▼
Revoke old token
reason = "token_rotation"
      │
      ▼
Create new refresh token
      │
      ▼
Create new access token
      │
      ▼
Return both
```

### One important recommendation

**Don't store the raw refresh token in PostgreSQL.** Store a cryptographic hash of it instead.

For example:

```text
Client:
refreshToken = "random-secret-value"

Database:
refresh_token_hash = SHA256(refreshToken)
```

Then when the client sends the refresh token, hash it and compare the hash with the database.

This way, if your database is compromised, the attacker doesn't immediately obtain usable refresh tokens.
