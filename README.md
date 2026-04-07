# 🎬 Video Personalization Platform

**Sendspark-like video personalization with AI voice cloning, dynamic backgrounds, and professional landing pages.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/video-personalization)

---

## ✨ Features

### 🎯 **Core Sendspark Workflow**
- ✅ **Record videos** - Cap-style recorder (camera/screen/both)
- ✅ **Clone voices** - Muapi + ElevenLabs integration
- ✅ **Import contacts** - CSV processing with validation
- ✅ **Generate personalized videos** - Bulk AI processing
- ✅ **Create landing pages** - GrapesJS visual editor
- ✅ **Share at scale** - Email templates, embed codes

### 🎨 **Professional Features**
- **Visual Page Builder** - Drag-and-drop GrapesJS editor
- **Dynamic Backgrounds** - Website screenshots + AI generation
- **Token Personalization** - `{{firstName}}`, `{{company}}` replacement
- **Multiple Templates** - Sales, product demo, follow-up
- **Responsive Design** - Mobile/tablet/desktop optimization
- **Analytics Ready** - Tracking framework included

### 🛠️ **Technical Stack**
- **Frontend:** Next.js 10, React 16, MobX
- **AI Services:** Muapi.ai (200+ models)
- **Page Builder:** GrapesJS (open source)
- **Video Processing:** WebRTC, MediaRecorder
- **Deployment:** Vercel, Docker, Node.js

---

## 🚀 **Quick Start**

### **1. Get API Keys**
```bash
# Required: Get Muapi.ai key
# https://muapi.ai
MUAPI_KEY=your_muapi_key_here
```

### **2. Install & Run**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:3000
```

### **3. Deploy to Production**
```bash
# Vercel (Recommended)
npm i -g vercel
vercel

# Or Docker
docker build -t video-personalization .
docker run -p 3000:3000 -e MUAPI_KEY=your_key video-personalization
```

---

## 📋 **Complete User Journey**

### **Step 1: Choose Mode**
Navigate to `/personalize` and select:
- **Sendspark Workflow** (Recommended) - Complete 5-step process
- **Landing Page Builder** - Visual page creation
- **AI Video Generation** - Direct AI video creation
- **Overlay Personalization** - Existing video editing

### **Step 2: Record Your Video**
Use the professional recorder with:
- **Camera Mode** - Webcam recording
- **Screen Mode** - Screen capture for demos
- **Both Mode** - Picture-in-picture recording
- **3-second countdown** to prevent mistakes

### **Step 3: Import Contacts**
Upload CSV with columns:
```csv
email,firstName,lastName,company,website,industry,title
john@acme.com,John,Doe,Acme Inc,https://acme.com,Technology,CEO
```

### **Step 4: Clone Voice & Generate**
- AI extracts audio from your video
- Clones your voice using ElevenLabs models
- Processes tokens like `{{firstName}}` → "John"
- Generates videos with dynamic backgrounds

### **Step 5: Create Landing Pages**
Use GrapesJS visual editor to:
- Choose from 4 professional templates
- Drag personalized video components
- Add text with token insertion
- Customize colors and styling
- Generate shareable URLs

---

## 🎨 **GrapesJS Page Builder**

### **Templates Available:**
1. **Sales Introduction** - Corporate outreach
2. **Product Demo** - Showcase features
3. **Follow-Up** - Nurture campaigns
4. **Minimal Professional** - Clean design

### **Components:**
- **Personalized Video** - Auto-embed with your content
- **Dynamic Text** - Token-aware text blocks
- **CTA Buttons** - Customizable call-to-actions
- **Contact Cards** - Auto-populated contact info
- **Background Images** - Dynamic website screenshots

### **Features:**
- **Visual Editing** - Drag-and-drop interface
- **Token Support** - `{{firstName}}` auto-replacement
- **Responsive Preview** - Test on all devices
- **SEO Optimization** - Meta tags and Open Graph
- **Export Options** - HTML, embed codes, share links

---

## 🔧 **API Integration**

### **Required Services:**
```bash
# Muapi.ai - All AI features
MUAPI_KEY=your_muapi_key_here

# Provides:
# - Voice cloning (ElevenLabs models)
# - Image generation (Flux models)
# - Video processing (Kling models)
# - Lip-sync animation (LTX models)
```

### **Optional Services:**
```bash
# PageShot - Free website screenshots
# No API key needed!

# ElevenLabs - Enhanced voice cloning
ELEVENLABS_API_KEY=your_key_here
```

---

## 📊 **Technical Specifications**

### **Performance:**
- **Video Generation:** 2-4 minutes per video
- **Voice Cloning:** 30-60 seconds
- **Background Generation:** 2-5 seconds (PageShot) / 10-30 seconds (AI)
- **Landing Page Creation:** Instant

### **Scalability:**
- **Concurrent Users:** 1000+ (Vercel)
- **Video Storage:** External CDN integration
- **API Limits:** Based on Muapi.ai plan
- **Database:** Optional (file-based for demo)

### **Security:**
- **API Key Protection** - Server-side only
- **CORS Configuration** - Controlled origins
- **Input Validation** - All user inputs validated
- **Rate Limiting** - Built-in protections

---

## 🐛 **Troubleshooting**

### **Node.js Compatibility:**
```bash
# If you get OpenSSL errors:
NODE_OPTIONS='--openssl-legacy-provider' npm run dev

# Or use Node.js 16/18:
nvm use 18
npm install
```

### **API Issues:**
```bash
# Test API connectivity:
curl -H "x-api-key: $MUAPI_KEY" https://api.muapi.ai/api/v1/status

# Check PageShot:
curl "https://pageshot.site/v1/screenshot?url=https://example.com"
```

### **Build Issues:**
```bash
# Clear cache and rebuild:
rm -rf node_modules .next
npm install
npm run build
```

---

## 🚀 **Deployment Options**

### **Vercel (Easiest):**
```bash
npm i -g vercel
vercel
# Add MUAPI_KEY environment variable
```

### **Docker:**
```bash
docker build -t video-personalization .
docker run -p 3000:3000 -e MUAPI_KEY=your_key video-personalization
```

### **Traditional Server:**
```bash
npm run build
npm start
```

---

## 📈 **What's Included**

### **Complete Application:**
- ✅ **Video Personalization Hub** - Main interface
- ✅ **Sendspark Workflow** - 5-step process
- ✅ **Video Recorder** - Professional recording
- ✅ **Contact Importer** - CSV processing
- ✅ **Voice Cloning** - AI voice processing
- ✅ **Bulk Generator** - Mass video creation
- ✅ **GrapesJS Editor** - Visual page builder
- ✅ **Landing Pages** - Dynamic route rendering
- ✅ **Templates** - Professional designs
- ✅ **Analytics** - Tracking framework

### **Open Source Libraries:**
- ✅ **GrapesJS** - Visual page builder
- ✅ **html2canvas** - Screenshot capture
- ✅ **Muapi.ai** - AI service integration
- ✅ **PageShot** - Website screenshot service
- ✅ **Next.js** - React framework
- ✅ **MobX** - State management

### **Documentation:**
- ✅ **Deployment Guide** - `DEPLOYMENT_GUIDE.md`
- ✅ **API Documentation** - Inline code comments
- ✅ **Troubleshooting** - Common issues & solutions
- ✅ **Architecture** - System overview

---

## 🎯 **Use Cases**

### **Sales Teams:**
- Create personalized outreach videos
- Send via email with branded landing pages
- Track engagement and conversions

### **Marketing Agencies:**
- Bulk video personalization for campaigns
- Custom landing pages per client
- Professional templates and branding

### **Business Development:**
- Personalized introductions
- Follow-up sequences
- Industry-specific messaging

### **HR & Recruitment:**
- Candidate-specific welcome videos
- Company culture presentations
- Onboarding personalization

---

## 🤝 **Contributing**

### **Development:**
```bash
# Clone and install
git clone <repository>
npm install

# Start development
npm run dev

# Run tests
npm run verify
```

### **Adding Features:**
- Follow the existing architecture
- Add components to `/components/`
- Update routes in `/pages/`
- Add API logic to `/lib/`
- Update documentation

---

## 📄 **License**

**MIT License** - Free for personal and commercial use.

---

## 🎉 **Ready to Personalize!**

Your complete video personalization platform is ready. Start creating personalized videos that convert!

**Need help?** Check the `DEPLOYMENT_GUIDE.md` or open an issue.

---

*Built with Open-Higgsfield-AI integration*
*Sendspark-like functionality with open source freedom*
*April 2026*
