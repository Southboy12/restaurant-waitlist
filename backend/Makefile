.PHONY: install run test lint clean check dev setup help

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
VENV       := .venv
PYTHON     := $(VENV)/bin/python
PIP        := $(VENV)/bin/pip
UVICORN    := $(VENV)/bin/uvicorn
PYTEST     := $(VENV)/bin/pytest
RUFF       := $(VENV)/bin/ruff

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT       ?= 8000
HOST       ?= 0.0.0.0

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
setup: .venv/bin/activate ## Create virtualenv and install all dependencies

.venv/bin/activate: pyproject.toml
	@test -d $(VENV) || python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -e ".[dev]"
	@touch $@

install: setup ## Install dependencies (alias for setup)

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
run: ## Start the production server (no reload)
	$(UVICORN) app.main:app --host $(HOST) --port $(PORT)

dev: ## Start the dev server with auto-reload
	$(UVICORN) app.main:app --host $(HOST) --port $(PORT) --reload

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------
test: ## Run the full test suite
	$(PYTEST) tests/ -v --tb=short

test-quiet: ## Run tests in quiet mode
	$(PYTEST) tests/ -q

test-cov: ## Run tests with coverage report
	$(PYTEST) tests/ -v --tb=short --cov=app --cov-report=term-missing

# ---------------------------------------------------------------------------
# Lint
# ---------------------------------------------------------------------------
lint: ## Run ruff linter
	$(RUFF) check app/ tests/

format: ## Auto-format with ruff
	$(RUFF) format app/ tests/

lint-fix: ## Auto-fix lint issues
	$(RUFF) check --fix app/ tests/

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
clean: ## Remove virtualenv, cache, and build artifacts
	rm -rf $(VENV) .pytest_cache .ruff_cache __pycache__ .coverage
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true

# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
check: test lint ## Run tests and linter (CI-style check)

reinstall: clean setup ## Remove venv and reinstall from scratch
