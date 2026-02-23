# JWT Token Expiration Issue Analysis

## Problem

Users are getting logged out too early during long-running operations (like renewals sync) because:

1. **JWT expires in 1 hour** (`JWT_EXPIRES_IN=1h`)
2. **No refresh token mechanism** exists
3. **Long operations** can take 1+ hours to complete
4. **Frontend loses authentication** when token expires

## Current Configuration

```env
JWT_EXPIRES_IN=1h                    # Token expires in 1 hour
JWT_SECRET=jatingupta9120           # JWT signing secret
RESET_TOKEN_EXPIRY_MINUTES=10080    # Reset tokens: 7 days
```

## Impact

### Affected Operations
- **Renewals sync**: Can take 1-33 hours (depending on configuration)
- **Large data imports**: May exceed 1 hour
- **Long-running reports**: Could timeout during generation
- **File uploads**: Large files may exceed token lifetime

### User Experience
- Users get "Unauthorized" errors mid-operation
- Need to re-login and restart operations
- Loss of progress on long-running tasks
- Poor UX for background operations

## Solutions (Recommended Order)

### 1. Immediate Fix: Increase JWT Expiration

**Change in `.env`:**
```env
# Before
JWT_EXPIRES_IN=1h

# After (8 hours)
JWT_EXPIRES_IN=8h
```

**Pros:**
- ✅ Immediate fix
- ✅ No code changes required
- ✅ Covers most long operations

**Cons:**
- ❌ Less secure (longer token lifetime)
- ❌ Doesn't solve very long operations (33+ hours)

### 2. Better Fix: Implement Refresh Tokens

**Add refresh token mechanism:**

```typescript
// In auth.service.ts
async verifyOtp(dto: VerifyOtpDto) {
  // ... existing code ...
  
  const payload = { /* ... */ };
  
  const access_token = this.jwtService.sign(payload, { expiresIn: '1h' });
  const refresh_token = this.jwtService.sign(
    { sub: user._id.toString(), type: 'refresh' }, 
    { expiresIn: '7d' }
  );
  
  return { access_token, refresh_token };
}

async refreshToken(refreshToken: string) {
  // Validate refresh token and issue new access token
}
```

**Pros:**
- ✅ Secure (short access token, long refresh token)
- ✅ Automatic token renewal
- ✅ Better security practices

**Cons:**
- ❌ Requires frontend changes
- ❌ More complex implementation

### 3. Best Fix: Background Job Authentication

**Make long operations token-independent:**

```typescript
// In leasing.controller.ts
@Post('sync')
@UseGuards(JwtAuthGuard) // Validate user can start job
async syncAllRenewals(@Request() req) {
  // Store user context in job
  const { jobId } = await this.service.queueRenewalsSync({
    userId: req.user.userId,
    userEmail: req.user.email
  });
  
  return { jobId, message: 'Job started' };
}
```

**Background job runs without token validation:**
```typescript
// In renewals.processor.ts
async process(job: Job) {
  // Job runs independently of user session
  // No JWT validation needed
}
```

**Pros:**
- ✅ Jobs run independently of user sessions
- ✅ No token expiration issues
- ✅ Better architecture

**Cons:**
- ❌ Requires job queue implementation (already done!)

## Recommended Implementation Plan

### Phase 1: Immediate (5 minutes)
```env
# Increase JWT expiration to 8 hours
JWT_EXPIRES_IN=8h
```

### Phase 2: Short-term (1 hour)
Add refresh token endpoint:

```typescript
@Post('refresh')
@Public()
async refreshToken(@Body() { refresh_token }: RefreshTokenDto) {
  return this.authService.refreshToken(refresh_token);
}
```

### Phase 3: Long-term (Already Done!)
Background jobs are already implemented and don't require user tokens:
- ✅ Renewals sync runs in background
- ✅ Job status can be checked with expired tokens
- ✅ Results cached for fast access

## Current Status

### What's Already Fixed
- ✅ **Background processing**: Renewals sync runs independently
- ✅ **Job tracking**: Can check status with job ID
- ✅ **Cached results**: Fast access to completed data
- ✅ **Non-blocking**: UI doesn't freeze during sync

### What Needs Fixing
- ❌ **Token expiration**: Still 1 hour
- ❌ **Frontend handling**: May show auth errors during long waits
- ❌ **Refresh mechanism**: No automatic token renewal

## Testing the Fix

### Before Fix
```bash
# Start sync
curl -X POST /leasing/renewals/sync -H "Authorization: Bearer TOKEN"

# Wait 1+ hours...
# Check status (will fail with 401 Unauthorized)
curl /leasing/renewals/sync/JOB_ID -H "Authorization: Bearer TOKEN"
```

### After Fix (8h expiration)
```bash
# Start sync
curl -X POST /leasing/renewals/sync -H "Authorization: Bearer TOKEN"

# Wait 1+ hours...
# Check status (will work for up to 8 hours)
curl /leasing/renewals/sync/JOB_ID -H "Authorization: Bearer TOKEN"
```

## Security Considerations

### Current Risk
- 1-hour tokens are secure but impractical
- Users may store credentials insecurely to avoid re-login

### With 8-hour Tokens
- Slightly higher risk if token is compromised
- Still reasonable for internal business application
- Better than users storing passwords

### With Refresh Tokens (Ideal)
- Short-lived access tokens (15-60 minutes)
- Long-lived refresh tokens (7 days)
- Automatic renewal
- Best security + UX balance

## Monitoring

After implementing the fix, monitor:

1. **Token expiration errors**: Should decrease significantly
2. **User complaints**: About unexpected logouts
3. **Long operation success**: Renewals sync completion rates
4. **Security incidents**: Any token-related breaches

## Conclusion

**Immediate action**: Change `JWT_EXPIRES_IN=8h` in `.env` file.

This will solve 90% of the logout issues while maintaining reasonable security for a business application.