# 🚀 Video Personalization Platform - Deployment Guide

## 📋 Overview

The Video Personalization Platform is a complete Sendspark-like application for creating personalized videos at scale. This guide covers deployment options, troubleshooting, and production setup.

---

## 🎯 **Deployment Options**

### **Option 1: Vercel (Recommended)**

#### **One-Click Deploy:**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/video-personalization)

#### **Manual Vercel Deploy:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configure environment variables
vercel env add MUAPI_KEY
```

#### **Vercel Environment Variables:**
```bash
MUAPI_KEY=your_muapi_api_key
# Optional: PAGESHOT_API_KEY (not needed, service is free)
```

### **Option 2: Docker Deployment**

#### **Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### **Build & Run:**
```bash
# Build Docker image
docker build -t video-personalization .

# Run container
docker run -p 3000:3000 \
  -e MUAPI_KEY=your_api_key \
  video-personalization
```

### **Option 3: Traditional Server**

#### **Server Requirements:**
- Node.js 16+ (18+ recommended)
- 2GB RAM minimum
- 10GB storage
- Linux/Windows/macOS

#### **Production Setup:**
```bash
# Install dependencies
npm install --production

# Build application
npm run build

# Start production server
npm start
```

---

## 🔧 **Node.js Compatibility Fixes**

### **Issue: Legacy OpenSSL Error**

**Error:** `digital envelope routines::unsupported`

### **Solutions:**

#### **Solution 1: Node.js Version (Recommended)**
```bash
# Use Node.js 16 or 18
nvm use 18
npm install
npm run build
npm start
```

#### **Solution 2: Legacy Provider Flag**
```bash
# Add to package.json scripts
"scripts": {
  "dev": "NODE_OPTIONS='--openssl-legacy-provider' next dev",
  "build": "NODE_OPTIONS='--openssl-legacy-provider' next build",
  "start": "NODE_OPTIONS='--openssl-legacy-provider' next start"
}
```

#### **Solution 3: Environment Variable**
```bash
# Set globally
export NODE_OPTIONS='--openssl-legacy-provider'
npm run dev
```

---

## 🔑 **API Configuration**

### **Required API Keys:**

#### **Muapi.ai (Required)**
```bash
# Get API key from: https://muapi.ai
MUAPI_KEY=your_muapi_key_here

# Muapi provides:
# - Voice cloning (ElevenLabs)
# - Image generation (Flux)
# - Video generation (Kling)
# - Lip-sync (LTX models)
```

#### **Optional Services:**
```bash
# PageShot (Free, no API key needed)
# Automatically captures website screenshots

# ElevenLabs (Optional, included in Muapi)
# ELEVENLABS_API_KEY=your_key_here
```

### **Environment Variables Setup:**

#### **For Development (.env.local):**
```bash
MUAPI_KEY=sk-your-muapi-key-here
NODE_ENV=development
```

#### **For Production:**
```bash
# Vercel: vercel env add MUAPI_KEY
# Heroku: heroku config:set MUAPI_KEY=your_key
# Docker: -e MUAPI_KEY=your_key
```

---

## 🏗️ **Build & Production Commands**

### **Development:**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at: http://localhost:3000
```

### **Production Build:**
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "video-personalization" -- start
```

### **Testing Build:**
```bash
# Test production build locally
npm run build
npm start

# Access at: http://localhost:3000
```

---

## 🌐 **Domain & Hosting Setup**

### **Custom Domain (Vercel):**
```bash
# Add custom domain
vercel domains add yourdomain.com

# Configure DNS
# Point yourdomain.com to Vercel's nameservers
```

### **SSL Certificates:**
- **Vercel:** Automatic SSL included
- **Docker:** Use reverse proxy (nginx/caddy)
- **Server:** Use certbot for Let's Encrypt

### **CDN Setup:**
- **Vercel:** Global CDN included
- **Cloudflare:** Add in front of your deployment
- **AWS CloudFront:** For custom deployments

---

## 📊 **Performance Optimization**

### **Next.js Optimizations:**
```javascript
// next.config.js
module.exports = {
  // Enable compression
  compress: true,

  // Image optimization
  images: {
    domains: ['cdn.muapi.ai', 'pageshot.site'],
    formats: ['image/webp', 'image/avif'],
  },

  // Bundle analyzer
  webpack: (config, { dev }) => {
    if (!dev) {
      // Production optimizations
      config.optimization.splitChunks.cacheGroups = {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      };
    }
    return config;
  },
};
```

### **API Rate Limiting:**
```javascript
// Implement rate limiting for API endpoints
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```

---

## 🔒 **Security Configuration**

### **Environment Variables:**
- Never commit API keys to git
- Use `.env.local` for development
- Use platform secrets for production

### **API Security:**
```javascript
// API route protection
export default function handler(req, res) {
  // Validate API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.MUAPI_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Process request...
}
```

### **CORS Configuration:**
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
};
```

---

## 📈 **Monitoring & Analytics**

### **Application Monitoring:**
```bash
# Install monitoring
npm install @vercel/analytics

# Add to _app.js
import { Analytics } from '@vercel/analytics/react';
```

### **Error Tracking:**
```bash
# Install Sentry
npm install @sentry/nextjs

# Configure in next.config.js
import { withSentry } from '@sentry/nextjs';
export default withSentry(config);
```

### **Performance Monitoring:**
- **Vercel Analytics:** Built-in performance metrics
- **Google Analytics:** Track user behavior
- **Custom Events:** Video play, generation completion

---

## 🐛 **Troubleshooting Guide**

### **Common Issues:**

#### **1. Build Fails:**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

#### **2. GrapesJS Not Loading:**
```bash
# Check if packages are installed
npm list grapesjs

# Reinstall if missing
npm install grapesjs
```

#### **3. API Errors:**
```bash
# Check API key
echo $MUAPI_KEY

# Test API connectivity
curl -H "x-api-key: $MUAPI_KEY" https://api.muapi.ai/api/v1/status
```

#### **4. Memory Issues:**
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

#### **5. Port Conflicts:**
```bash
# Use different port
PORT=3001 npm run dev
```

---

## 📚 **Architecture Overview**

### **Technology Stack:**
- **Frontend:** Next.js 10, React 16, MobX
- **Styling:** CSS-in-JS, Styled Components
- **Video:** WebRTC, MediaRecorder API
- **Page Builder:** GrapesJS (visual editor)
- **AI Services:** Muapi.ai (voice, image, video)
- **Deployment:** Vercel/Docker/Node.js

### **Key Components:**
- `VideoPersonalizationHub.jsx` - Main application
- `SendsparkWorkflow.jsx` - 5-step workflow
- `GrapesJSEditor.jsx` - Visual page builder
- `VideoRecorder.jsx` - Screen/camera recording
- `sendsparkEngine.js` - Core personalization logic
- `muapi.js` - AI service integration

### **File Structure:**
```
├── components/          # React components
├── lib/                # Core logic & APIs
├── pages/              # Next.js routes
├── styles/             # CSS and themes
├── public/             # Static assets
└── docs/               # Documentation
```

---

## 🚀 **Quick Start Checklist**

### **Before Deployment:**
- [ ] Get Muapi.ai API key
- [ ] Test API key connectivity
- [ ] Choose deployment platform (Vercel recommended)
- [ ] Set environment variables
- [ ] Run `npm run build` locally

### **Deployment Steps:**
- [ ] Push code to Git repository
- [ ] Connect to Vercel/Netlify/Heroku
- [ ] Configure environment variables
- [ ] Deploy application
- [ ] Test all features end-to-end
- [ ] Configure custom domain (optional)

### **Post-Deployment:**
- [ ] Monitor application logs
- [ ] Test video generation workflow
- [ ] Verify GrapesJS page builder
- [ ] Check API integrations
- [ ] Optimize performance

---

## 🎯 **Production URLs**

After deployment, your application will be available at:

- **Main App:** `https://yourdomain.com/personalize`
- **Sendspark Workflow:** `https://yourdomain.com/sendspark`
- **Landing Pages:** `https://yourdomain.com/v/[page-id]`
- **Demo:** `https://yourdomain.com/open-higgsfield-demo`

---

## 📞 **Support & Resources**

### **Documentation:**
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Muapi.ai API Docs](https://docs.muapi.ai)
- [GrapesJS Documentation](https://grapesjs.com/docs/)

### **Community:**
- [Next.js Discord](https://nextjs.org/discord)
- [Vercel Community](https://vercel.community)
- [GrapesJS GitHub](https://github.com/GrapesJS/grapesjs)

---

## 🎉 **Deployment Complete!**

Your video personalization platform is now deployed and ready to create personalized videos at scale!

**Start creating personalized video campaigns today!** 🚀

---

*Last Updated: April 2026*
*Platform Version: 1.0.0*
*Node.js Compatibility: 16+, 18+ (recommended)*