# ============================================
# Stage 1: Build the frontend (Node.js)
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files first for better caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy the rest of the frontend source
COPY frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/index.html ./
COPY frontend/src ./src
COPY frontend/public ./public

# Build the frontend
RUN npm run build

# The built static files are in /app/frontend/dist


# ============================================
# Stage 2: Build the Python backend image
# ============================================
FROM python:3.12-slim AS backend

WORKDIR /app

# Copy backend dependency file first for better caching
COPY backend/pyproject.toml backend/README.md ./

# Install Python dependencies from pyproject.toml
RUN pip install --no-cache-dir . && \
    pip install --no-cache-dir uvicorn[standard]

# Copy the backend application code
COPY backend/app ./app

# Copy the frontend static files from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose the backend port
EXPOSE 8000

# Run the backend with uvicorn
# The backend serves the frontend static files from ./static
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

