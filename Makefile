.PHONY: up down infra api app website website-install test migrate lint dev sdk-install sdk-example

# ── Infrastructure ──────────────────────────────────────────
infra:
	docker compose up -d

infra-down:
	docker compose down

infra-reset:
	docker compose down -v

# ── Backend (FastAPI) ───────────────────────────────────────
api:
	cd api && .venv/bin/uvicorn app.main:app --reload --port 8000

api-install:
	cd api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"

# ── Frontend (Next.js) ─────────────────────────────────────
app:
	cd app && npm run dev

app-install:
	cd app && npm install

# ── Website (Next.js) ─────────────────────────────────────
website:
	cd website && pnpm dev

website-install:
	cd website && pnpm install

# ── Database Migrations ────────────────────────────────────
migrate:
	cd api && .venv/bin/alembic upgrade head

migrate-new:
	@read -p "Migration message: " msg && cd api && .venv/bin/alembic revision --autogenerate -m "$$msg"

# ── Tests ──────────────────────────────────────────────────
test:
	cd api && .venv/bin/pytest tests/ -v

test-api:
	cd api && .venv/bin/pytest tests/ -v

# ── Lint / Typecheck ───────────────────────────────────────
lint:
	cd app && npx tsc --noEmit



# ── Combo Commands ─────────────────────────────────────────
dev: infra
	@echo "Infrastructure up. Run 'make api' and 'make app' in separate terminals."

install: api-install app-install sdk-install
