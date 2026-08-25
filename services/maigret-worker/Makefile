.PHONY: help install dev test lint format clean docker-build docker-up docker-down

help:
	@echo "Maigret worker targets:"
	@echo "  make install      - create venv and install dependencies"
	@echo "  make dev          - run uvicorn locally with hot reload"
	@echo "  make test         - run pytest"
	@echo "  make lint         - run ruff + mypy"
	@echo "  make format       - auto-format with ruff"
	@echo "  make docker-build - build the Docker image"
	@echo "  make docker-up    - bring up worker + redis via docker compose"
	@echo "  make docker-down  - stop docker compose stack"
	@echo "  make clean        - remove build artifacts and venv"

install:
	python3.12 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt

dev:
	. .venv/bin/activate && uvicorn app.main:app --reload --port 8000

test:
	. .venv/bin/activate && pytest -v

lint:
	. .venv/bin/activate && ruff check app tests && mypy app

format:
	. .venv/bin/activate && ruff format app tests && ruff check --fix app tests

docker-build:
	docker build -t maigret-worker .

docker-up:
	cp -n .env.example .env 2>/dev/null || true
	docker compose up --build

docker-down:
	docker compose down

clean:
	rm -rf .venv __pycache__ */__pycache__ */*/__pycache__ .pytest_cache .mypy_cache .ruff_cache
