FROM node:22.8.0-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 10000

# Vite preview serves the production build. Render assigns a dynamic port via
# the PORT env var; pass it through so the server binds to the expected port.
CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-10000}"]
