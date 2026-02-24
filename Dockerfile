# ── Stage: build ────────────────────────────────────────────────────────────
FROM python:3.11-slim

# WeasyPrint needs these system libraries (Pango, Cairo, GLib, fonts)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Railway injects PORT at runtime; default to 8000 for local testing
ENV PORT=8000

# Expose the port (informational only — Railway reads $PORT)
EXPOSE 8000

# Start the app with uvicorn, binding to $PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
