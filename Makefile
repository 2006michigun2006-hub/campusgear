# CampusGear — common tasks. Works from PowerShell, cmd and Git Bash (GNU make 4.x).
#   make dev    local development with hot reload  -> http://localhost:5173
#   make prod   production build, served by Node   -> http://localhost:3000
# Recipes only call node/npm so they behave the same in every shell.

.DEFAULT_GOAL := help
.PHONY: help install db db-stop db-reset db-status dev build prod test demo-reset clean

DEPS := node_modules/.package-lock.json

# Local defaults for `make prod`; override like: make prod PORT=8080
DATABASE_URL          ?= postgres://campusgear:campusgear@localhost:55432/campusgear
PORT                  ?= 3000
STAFF_PASSWORD        ?= staff-demo-pass
DEMO_STUDENT_PASSWORD ?= student-demo-pass

help:
	@echo CampusGear make targets:
	@echo   make dev        - start Postgres, API and Vite with hot reload: http://localhost:5173
	@echo   make prod       - start Postgres, build the client, run in production mode: http://localhost:3000
	@echo   make test       - start Postgres and run the test suite
	@echo   make build      - build the client into dist/
	@echo   make install    - install npm dependencies
	@echo   make db         - start the local Postgres container
	@echo   make db-stop    - stop the Postgres container, data is kept
	@echo   make db-reset   - delete the Postgres container and all local data, then recreate it
	@echo   make db-status  - show the container status
	@echo   make demo-reset - delete all accounts and bookings in the local database and re-seed demo data
	@echo   make clean      - remove dist/

# Reinstall only when package.json or the lockfile changed.
# --include=dev: `prod` exports NODE_ENV=production, which would otherwise skip Vite.
$(DEPS): package.json package-lock.json
	npm install --include=dev

install: $(DEPS)

db:
	node scripts/db.mjs up

db-stop:
	node scripts/db.mjs stop

db-reset:
	node scripts/db.mjs reset

db-status:
	node scripts/db.mjs status

dev: $(DEPS) db
	node scripts/dev.mjs

build: $(DEPS)
	npm run build

prod: export NODE_ENV := production
prod: export DATABASE_URL := $(DATABASE_URL)
prod: export PORT := $(PORT)
prod: export STAFF_PASSWORD := $(STAFF_PASSWORD)
prod: export DEMO_STUDENT_PASSWORD := $(DEMO_STUDENT_PASSWORD)
prod: $(DEPS) db build
	npm start

test: $(DEPS) db
	npm test

demo-reset: $(DEPS) db
	node server/reset-demo.js --yes

clean:
	node -e "require('fs').rmSync('dist', { recursive: true, force: true })"
