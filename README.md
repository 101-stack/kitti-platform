# 🎴 Kitti Multiplayer Card Game Platform

Real-time multiplayer 9-card game (Kitti) with Node.js + FastAPI + Next.js + PostgreSQL + Redis.

## 🚀 Production Deployment (Docker + Nginx)

The production setup uses Nginx as a reverse proxy with security headers and Gzip compression enabled.

```bash
# 1. Configure environment
cp .env.example .env # Root env with DB credentials
# Also edit frontend/.env.local, node-server/.env, fastapi-service/.env

# 2. Run migrations (First time or updates)
docker-compose -f docker/docker-compose.prod.yml run --rm fastapi alembic upgrade head

# 3. Start the production stack
docker-compose -f docker/docker-compose.prod.yml up --build -d

# 4. Access via http://your-domain.com
```

## 🛠️ Local Development (Docker)

```bash
docker-compose -f docker/docker-compose.yml up --build
```

## Quick Start (Manual)

```bash
# Terminal 1: PostgreSQL + Redis (Docker)
docker run -d -e POSTGRES_DB=kitti_db -e POSTGRES_USER=kitti \
  -e POSTGRES_PASSWORD=kitti_pass -p 5432:5432 postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine
psql -U kitti -d kitti_db -f database/schema.sql

# Terminal 2: FastAPI
cd fastapi-service && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 3: Node.js
cd node-server && npm install && npm run dev

# Terminal 4: Next.js
cd frontend && npm install && npm run dev
```

## Services

| Service    | Port | Description              |
|------------|------|--------------------------|
| Frontend   | 3000 | Next.js UI               |
| Node.js    | 4000 | Socket.IO real-time      |
| FastAPI    | 8000 | Game logic + REST API    |
| PostgreSQL | 5432 | Persistent data          |
| Redis      | 6379 | Live game state          |

## Documentation

See `docs/KITTI_PLATFORM_DOCUMENTATION.txt` for complete docs including:
- Full architecture explanation
- All API endpoints
- Socket.IO event reference  
- Database schema
- Deployment guide
- Scaling strategy
