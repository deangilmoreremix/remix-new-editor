FROM python:3.12-slim

WORKDIR /app

# When dockerContext is repo root, copy only the backend subtree so
# requirements.txt, pyproject.toml, and the `director/` package all land
# at /app/ as expected.
COPY . /app/

RUN pip install --no-cache-dir -r requirements.txt

# Only initialize SQLite when DB_TYPE is sqlite (the default).
# When DB_TYPE=postgres (as on Render), the Postgres database is
# provisioned separately and migrations are handled by the server.
RUN if [ "${DB_TYPE:-sqlite}" = "sqlite" ]; then \
      [ ! -f director.db ] && python director/db/sqlite/initialize.py || echo "Database already initialized."; \
    else \
      echo "Skipping SQLite init (DB_TYPE=${DB_TYPE:-sqlite})"; \
    fi

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:10000/health').read()" || exit 1

# Render assigns a dynamic port via the PORT env var; map it to SERVER_PORT
# (which server.py reads) so the Flask process binds to the expected port.
CMD ["sh", "-c", "export SERVER_PORT=${PORT:-10000} && python director/entrypoint/api/server.py"]
