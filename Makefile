# Variables
COMPOSE = docker-compose

.PHONY: help up down restart logs ps build clean db-shell

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Build and start all containers in the background
	$(COMPOSE) up -d --build

down: ## Stop and remove all containers
	$(COMPOSE) down

restart: down up ## Restart all containers

logs: ## Follow logs from all containers
	$(COMPOSE) logs -f

ps: ## List running containers
	$(COMPOSE) ps

build: ## Rebuild all containers without starting
	$(COMPOSE) build

clean: ## Stop containers and remove volumes, images, and orphaned containers
	$(COMPOSE) down -v --rmi all --remove-orphans

db-shell: ## Access the PostgreSQL terminal
	docker exec -it sprint_db psql -U postgres -d sprint_db

backend-shell: ## Access the backend container shell
	docker exec -it sprint_backend sh

frontend-shell: ## Access the frontend container shell
	docker exec -it sprint_frontend sh

status: ## Show status of all services with health checks
	@echo "Checking system status..."
	@curl -s http://localhost:5001/api/health || echo "Backend unreachable at :5001"
