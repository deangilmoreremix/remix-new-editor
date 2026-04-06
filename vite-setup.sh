#!/bin/bash
# Complete Vite Remix Editor Setup Script

set -e

echo "🚀 Creating Vite Remix Editor project..."

# Create directory structure
mkdir -p vite-remix-editor/src/{components/{modals,forms,media,common},styles,utils,constants}
mkdir -p vite-remix-editor/public/static/images

# Create package.json
cat > vite-remix-editor/package.json << 'EOL'
{
  "name": "vite-remix-editor",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {
    "cropperjs": "^1.6.1",
    "sortablejs": "^1.15.0",
    "lottie-web": "^5.12.2"
  }
}
EOL

# Create vite.config.js
cat > vite-remix-editor/vite.config.js << 'EOL'
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true
  }
})
EOL

echo "📁 Created project structure and config files"
echo "✅ Vite Remix Editor setup complete!"
echo ""
echo "📋 To use the project:"
echo "cd vite-remix-editor"
echo "npm install"
echo "npm run dev"
