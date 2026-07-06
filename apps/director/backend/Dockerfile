FROM python:3.12-slim

WORKDIR /app

COPY . /app/

RUN pip install --no-cache-dir -r requirements.txt

RUN [ ! -f director.db ] && python director/db/sqlite/initialize.py || echo "Database already initialized."

EXPOSE 10000

# Render assigns a dynamic port via the PORT env var; map it to SERVER_PORT
# (which server.py reads) so the Flask process binds to the expected port.
CMD ["sh", "-c", "export SERVER_PORT=${PORT:-10000} && python director/entrypoint/api/server.py"]
