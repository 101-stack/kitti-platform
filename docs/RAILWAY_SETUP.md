# Railway Deployment Setup Guide

This project deploys to Railway as three app services plus two managed data services:

- `frontend` for the Next.js app
- `fastapi-service` for the REST API
- `node-server` for Socket.IO
- PostgreSQL for persistent data
- Redis for live room and game state

## Before You Start

1. Install the Railway CLI.
2. Run `railway login`.
3. From the repo root, run `railway link` and connect this folder to the correct Railway project.

If `railway status` fails or says your token is invalid, log in again before doing anything else.

## Create the Railway Services

Create or confirm these services in the Railway dashboard:

- `frontend`
- `fastapi-service`
- `node-server`
- PostgreSQL
- Redis

Each app service should point at the matching folder in this repo:

- `frontend` -> `frontend/`
- `fastapi-service` -> `fastapi-service/`
- `node-server` -> `node-server/`

Each of those folders already includes its own `Dockerfile` and `railway.json`.

## Link Managed Services

In the Railway dashboard:

1. Link PostgreSQL to `fastapi-service` so it receives `DATABASE_URL`.
2. Link Redis to `fastapi-service` so it receives `REDIS_URL`.
3. Link Redis to `node-server` so it receives `REDIS_URL`.

Do not hardcode database or Redis credentials in the repo. Railway should provide them through linked service variables.

## Set App URLs and Shared Secrets

Run the helper from the repo root after you know the public Railway URLs for your three app services:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy_railway.ps1 `
  -FrontendUrl "https://your-frontend.up.railway.app" `
  -FastAPIUrl "https://your-fastapi.up.railway.app" `
  -NodeUrl "https://your-node-server.up.railway.app"
```

What it does:

- generates a shared `JWT_SECRET`
- generates a shared `INTERNAL_API_KEY`
- sets frontend public API URLs
- sets FastAPI and Node service-to-service URLs
- redeploys all three services

Optional flags:

- `-Environment "production"` if you use a named Railway environment
- `-FrontendService`, `-FastAPIService`, `-NodeService` if your Railway service names differ
- `-SkipRedeploy` if you only want to update variables

## Deploy the Services

If the services are already connected to this repo in Railway, pushing to your Git remote may be enough.

If you want to deploy directly from the CLI, run these from the repo root:

```powershell
railway up --service frontend --path .\frontend --path-as-root
railway up --service fastapi-service --path .\fastapi-service --path-as-root
railway up --service node-server --path .\node-server --path-as-root
```

## Verify the Deployment

Check these endpoints after deploy:

- Frontend: open the site in a browser
- FastAPI: `https://your-fastapi.up.railway.app/health`
- Node server: `https://your-node-server.up.railway.app/health`

Then test the real workflow:

1. Log in on the frontend.
2. Create a room.
3. Join the room.
4. Start a game.

## Troubleshooting

`railway login` errors:
- Run `railway login` again. This repo had an expired local Railway token.

Frontend loads but API calls fail:
- Check `NEXT_PUBLIC_FASTAPI_URL` on `frontend`.
- Check the browser network tab for requests hitting the wrong domain.

Socket connection fails:
- Check `NEXT_PUBLIC_NODE_SERVER_URL` on `frontend`.
- Check `FRONTEND_URL` on `node-server`.
- Check `REDIS_URL` exists on `node-server`.

FastAPI boots but database actions fail:
- Check `DATABASE_URL` exists on `fastapi-service`.
- Confirm PostgreSQL is linked to `fastapi-service`.

"Failed to join" or room state bugs:
- Confirm `REDIS_URL` exists on both `fastapi-service` and `node-server`.
- Confirm `JWT_SECRET` matches between `fastapi-service` and `node-server`.
- Confirm `INTERNAL_API_KEY` matches between `fastapi-service` and `node-server`.

## Useful Commands

```powershell
railway status
railway service list
railway service logs -s frontend
railway service logs -s fastapi-service
railway service logs -s node-server
```
