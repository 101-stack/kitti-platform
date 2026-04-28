# Railway Deployment Setup Guide

This guide provides step-by-step instructions for deploying Kitti Platform on Railway with proper service linking and environment configuration.

## Prerequisites

- Railway account: https://railway.app
- Railway CLI installed (optional but recommended)
- The project's existing Railway services (frontend, fastapi, node-server)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Railway Environment                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │   Frontend   │      │
│  │  (Database)  │  │  (Cache)     │  │  (Next.js)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         └─────────┬───────┴────────┬─────────┘              │
│                   │                │                        │
│             ┌─────┴──────┐  ┌──────┴──────┐               │
│             │   FastAPI   │  │ Node Server │               │
│             │  (Game API) │  │ (WebSocket) │               │
│             └─────────────┘  └─────────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Add PostgreSQL Service

1. Go to your Railway project dashboard
2. Click **+ New** and select **Database**
3. Choose **PostgreSQL**
4. Wait for the service to be created
5. Click on the PostgreSQL service
6. Go to **Variables** tab
7. Note the `DATABASE_URL` - it will be automatically set

## Step 2: Add Redis Service

1. In your Railway project, click **+ New** and select **Redis**
2. Choose **Redis** database
3. Wait for the service to be created
4. Click on the Redis service
5. Go to **Variables** tab
6. Note the `REDIS_URL` - it will be automatically set

## Step 3: Link Services

### Link PostgreSQL to FastAPI

1. Open the **FastAPI** service
2. Go to **Variables** tab
3. Click **+ Add Variable**
4. Choose **DATABASE_URL** from PostgreSQL (it will auto-populate)
5. Save

### Link Redis to Node Server

1. Open the **Node Server** service
2. Go to **Variables** tab
3. Click **+ Add Variable**
4. Choose **REDIS_URL** from Redis (it will auto-populate)
5. Save

### Link Redis to FastAPI

1. Open the **FastAPI** service
2. Go to **Variables** tab
3. Click **+ Add Variable**
4. Choose **REDIS_URL** from Redis (it will auto-populate)
5. Save

## Step 4: Set Environment Variables

Run the enhanced deployment script which will automatically set all required variables:

```powershell
cd c:\Users\ASUS\Desktop\kitti-platform
powershell -ExecutionPolicy Bypass -File deploy_railway.ps1
```

This script will set:

### FastAPI Service
- `FRONTEND_URL` - Points to frontend
- `NODE_SERVER_URL` - Points to node server
- `JWT_SECRET` - Generated security key
- `INTERNAL_API_KEY` - Generated API key
- `NODE_ENV` - Set to "production"
- `DATABASE_URL` - Auto-linked from PostgreSQL
- `REDIS_URL` - Auto-linked from Redis

### Node Server Service
- `FASTAPI_URL` - Points to FastAPI
- `FRONTEND_URL` - Points to frontend
- `JWT_SECRET` - Same as FastAPI
- `INTERNAL_API_KEY` - Same as FastAPI
- `NODE_ENV` - Set to "production"
- `REDIS_URL` - Auto-linked from Redis

### Frontend Service
- `NEXT_PUBLIC_NODE_SERVER_URL` - Public WebSocket URL
- `NEXT_PUBLIC_FASTAPI_URL` - Public API URL

## Step 5: Database Migration

The FastAPI service needs to run migrations on first deployment:

### Option A: Using Railway CLI

```bash
railway run "cd /app && alembic upgrade head"
```

### Option B: Using Railway Dashboard

1. Open your Railway project
2. Go to FastAPI service
3. Click **Deploy** → **View Logs**
4. Run migrations manually if needed

## Step 6: Verify Deployment

After all services are running:

1. **Frontend**: https://kitti-platform-kitti.up.railway.app
2. **FastAPI**: https://fastapi-kitti.up.railway.app
3. **Node Server**: https://node-server-kitti.up.railway.app

### Health Checks

- FastAPI: `GET https://fastapi-kitti.up.railway.app/health`
- Node Server: `GET https://node-server-kitti.up.railway.app/health`
- Frontend: Visit the URL and check if login page loads

## Common Issues & Troubleshooting

### Issue: "Failed to join. Please try again."

**Possible Causes:**
- Redis connection failed
- FastAPI can't connect to database
- Inter-service communication broken
- JWT token validation failed

**Solutions:**
1. Check service logs in Railway dashboard
2. Verify all environment variables are set
3. Ensure services are linked (PostgreSQL → FastAPI, Redis → Node+FastAPI)
4. Check that `JWT_SECRET` is identical on FastAPI and Node Server
5. Verify CORS settings in Node Server index.js match `FRONTEND_URL`

### Issue: "Database connection error"

**Solution:**
- Verify `DATABASE_URL` is set in FastAPI
- Check PostgreSQL service is running
- Run migrations: `alembic upgrade head`

### Issue: "Redis connection failed"

**Solution:**
- Verify `REDIS_URL` is set in both Node Server and FastAPI
- Check Redis service is running
- Note: `REDIS_URL` supersedes individual `REDIS_HOST`/`REDIS_PORT` variables

### Issue: WebSocket connection fails

**Solution:**
- Verify Node Server service is running
- Check `NEXT_PUBLIC_NODE_SERVER_URL` is correct in frontend
- Ensure CORS origin in Node Server includes frontend URL
- Check WebSocket transport is enabled (not blocked by proxy)

## Environment Variable Reference

### Automatically Provided by Railway

When you link services, these are auto-set:
- `DATABASE_URL` (from PostgreSQL)
- `REDIS_URL` (from Redis)

### Must Be Set Manually or by Script

```
JWT_SECRET=<generated>
INTERNAL_API_KEY=<generated>
FRONTEND_URL=https://kitti-platform-kitti.up.railway.app
NODE_SERVER_URL=https://node-server-kitti.up.railway.app
NEXT_PUBLIC_NODE_SERVER_URL=https://node-server-kitti.up.railway.app
NEXT_PUBLIC_FASTAPI_URL=https://fastapi-kitti.up.railway.app
```

## Monitoring & Debugging

1. **View Logs**: Click on any service → **Logs** tab
2. **Check Variables**: Service → **Variables** tab
3. **Check Deployments**: Service → **Deployments** tab
4. **Monitor Resources**: Project → **Metrics** tab

## Security Notes

1. **JWT_SECRET** - Keep this secret! Should be different in each environment
2. **INTERNAL_API_KEY** - Used for service-to-service communication
3. **DATABASE_URL** - Contains credentials, keep secure
4. Never commit `.env` files with real credentials

## Deployment Checklist

- [ ] PostgreSQL service created and running
- [ ] Redis service created and running
- [ ] PostgreSQL linked to FastAPI (DATABASE_URL)
- [ ] Redis linked to Node Server (REDIS_URL)
- [ ] Redis linked to FastAPI (REDIS_URL)
- [ ] All environment variables set (via script or manually)
- [ ] Database migrations run
- [ ] FastAPI health check passes
- [ ] Node Server health check passes
- [ ] Frontend loads without errors
- [ ] Can login successfully
- [ ] Can create and join game rooms

## Scaling in Production

For production scaling:

1. **Database**: Enable PostgreSQL backups and replication
2. **Redis**: Consider Redis with persistence
3. **Node Server**: Use sticky sessions for Socket.IO
4. **Frontend**: Enable Vercel or Railway CDN caching
5. **API Rate Limiting**: Configure rate limits appropriately

## Support

For issues, check:
1. Railway service logs
2. Browser developer console (Network & Console tabs)
3. This troubleshooting guide
4. Project README.md
