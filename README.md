# TRACELY

Ship Fast, Stay Safe — open-source monitoring for APIs, web apps, and mobile apps.

## Project Structure

```
tracely/
├── api/          # FastAPI backend (Python 3.12+)
├── app/          # Next.js dashboard (TypeScript)
├── docs/         # Documentation (Fumadocs)
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose

### 1. Start databases

```bash
docker compose up -d
```

### 2. Start the API

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### 3. Start the dashboard

```bash
cd app
npm install
npm run dev
```

The API runs on http://localhost:8000 and the dashboard on http://localhost:3000.
