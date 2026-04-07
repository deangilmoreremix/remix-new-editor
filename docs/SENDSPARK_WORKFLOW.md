# Sendspark Workflow Documentation

## Overview

The Sendspark Workflow is a video personalization system that replicates Sendspark's actual workflow:

1. **Record your video once** using Cap-style recording
2. **Import contacts** via CSV
3. **Clone your voice** from the recording
4. **Generate personalized videos** for each contact with dynamic backgrounds
5. **Share/distribute** the videos

Unlike the AI avatar approach (which creates synthetic presenters), this workflow uses **your actual video and voice** to create authentic personalized content.

## Key Components

### 1. VideoRecorder Component
**File:** `/components/VideoRecorder.jsx`

A Cap-style video recorder supporting:
- **Camera recording**: Webcam capture with audio
- **Screen recording**: Screen capture for demos/presentations  
- **Picture-in-picture**: Both camera and screen simultaneously
- **Recording controls**: Start, pause, resume, stop
- **Countdown timer**: 3-second countdown before recording
- **Progress tracking**: Visual progress bar during recording
- **Preview**: Review recording before saving

**Usage:**
```jsx
import VideoRecorder from '../components/VideoRecorder';

<VideoRecorder
  onRecordingComplete={(recording) => {
    console.log('Recorded:', recording.url);
    console.log('Duration:', recording.duration);
    console.log('Blob:', recording.blob);
  }}
  maxDuration={60}
  allowScreen={true}
  allowCamera={true}
/>
```

### 2. SendsparkWorkflow Component
**File:** `/components/SendsparkWorkflow.jsx`

The main 5-step workflow component:

#### Step 1: Record
- Uses VideoRecorder component
- Records user's base video (30-60 seconds recommended)
- Stores video blob, URL, and duration

#### Step 2: Import Contacts
- CSV import via ContactImporterModal
- Validates email addresses
- Supports: firstName, lastName, company, email, website, industry, title
- Shows contact preview and statistics

#### Step 3: Clone Voice
- Extracts audio from recorded video
- Uses Muapi voice cloning API (ElevenLabs models)
- User enters script with personalization tokens
- Available tokens: `{{firstName}}`, `{{lastName}}`, `{{company}}`, `{{email}}`, `{{website}}`, `{{industry}}`, `{{title}}`

#### Step 4: Generate Videos
- Processes script for each contact with token replacement
- Generates audio with cloned voice
- Creates dynamic backgrounds:
  - Website screenshots (if contact has website)
  - AI-generated backgrounds based on industry
- Composites user video onto background
- Adds personalization text overlays

#### Step 5: Share
- Select videos to share
- Actions:
  - View individual videos
  - Copy video links
  - Generate email templates
  - Download videos
  - Get embed codes

**Usage:**
```jsx
import SendsparkWorkflow from '../components/SendsparkWorkflow';

<SendsparkWorkflow
  apiKey="your-muapi-key"
  onWorkflowComplete={(videos) => {
    console.log('Generated videos:', videos);
  }}
/>
```

### 3. SendsparkPersonalizationEngine
**File:** `/lib/sendsparkEngine.js`

Core engine class handling:

#### Voice Cloning
```javascript
const engine = new SendsparkPersonalizationEngine({
  apiKey: 'your-api-key',
  userVideo: recordedVideo
});

const clonedVoice = await engine.cloneUserVoice();
// Returns: { voiceId: 'cloned-voice-id' }
```

#### Contact Import
```javascript
await engine.importContacts([
  { email: 'john@example.com', firstName: 'John', company: 'Acme Inc' }
]);
```

#### Script Processing
```javascript
engine.script = "Hi {{firstName}}, welcome to {{company}}!";
engine.processScript();
// Returns personalized scripts for each contact
```

#### Video Generation
```javascript
const results = await engine.generatePersonalizedVideos((progress, videos) => {
  console.log(`${progress}% complete`);
});
```

#### Dynamic Backgrounds
- Website screenshots using PageShot API
- AI-generated backgrounds based on industry:
  - Technology: Modern tech office
  - Healthcare: Medical office
  - Finance: Corporate office
  - Education: Classroom setting
  - Default: Professional office

## Workflow Integration

### In VideoPersonalizationHub
The Sendspark workflow is now the **default and recommended** mode:

```jsx
// Mode selector includes:
// 1. Sendspark Workflow (Recommended) ✨
// 2. Overlay Personalization 🎬
// 3. AI Video Generation 🤖
```

### Dedicated Page
**File:** `/pages/sendspark.js`

A standalone page with:
- API key input/setup
- Full SendsparkWorkflow component
- Campaign history tracking
- Mobile-responsive design

**Route:** `/sendspark`

## API Requirements

### Required Services

1. **Muapi.ai** (or compatible)
   - Voice cloning (ElevenLabs models via Muapi)
   - Text-to-speech with cloned voices
   - Image generation (Flux)
   - Video generation (Kling)
   - Lip-sync animation

2. **PageShot** (optional, for website screenshots)
   - Website to image capture

### Environment Variables

```bash
# .env.local
MUAPI_KEY=your_muapi_key
PAGESHOT_API_KEY=your_pageshot_key
```

## Script Templates

### Sales Introduction
```
Hi {{firstName}},

I'm reaching out from {{myCompany}} to introduce our solution that helps companies like {{company}} increase productivity by 40%.

Would you be available for a quick call next week?

Best regards
```

### Follow-up
```
Hi {{firstName}},

I wanted to follow up on my previous message. I noticed {{company}} is doing great work in {{industry}}.

Our clients typically see a 30% improvement in their first 3 months.

Are you available for a brief call?

Best
```

### Personalized Outreach
```
Hello {{firstName}},

I came across {{company}} and was impressed by your work. As a {{myTitle}} at {{myCompany}}, I understand the challenges you face.

We've helped similar companies achieve remarkable results.

Would you have 10 minutes to chat?

Warm regards
```

## CSV Format

### Required Columns
- `email` (required)

### Optional Columns
- `firstName` / `first_name`
- `lastName` / `last_name`
- `company`
- `website`
- `industry`
- `title`

### Example CSV
```csv
email,firstName,lastName,company,website,industry,title
john@acme.com,John,Doe,Acme Inc,https://acme.com,Technology,CEO
jane@startup.com,Jane,Smith,TechStart,https://techstart.io,Software,Founder
```

## Technical Implementation

### Recording Flow
```
User clicks "Start Recording"
    ↓
3-second countdown
    ↓
MediaRecorder starts
    ↓
Record video + audio
    ↓
User clicks "Stop"
    ↓
Blob created
    ↓
Preview shown
    ↓
User saves or re-records
```

### Voice Cloning Flow
```
Extract audio from video
    ↓
Upload to Muapi API
    ↓
Clone voice (ElevenLabs via Muapi)
    ↓
Store voice ID
    ↓
Ready for TTS generation
```

### Video Generation Flow
```
For each contact:
    ↓
Process script (token replacement)
    ↓
Generate TTS audio with cloned voice
    ↓
Capture website screenshot OR generate AI background
    ↓
Composite user video onto background
    ↓
Apply video enhancements
    ↓
Generate thumbnail
    ↓
Store result
```

## Browser Compatibility

### Required APIs
- `MediaRecorder` - Video recording
- `getUserMedia` - Camera access
- `getDisplayMedia` - Screen sharing
- `URL.createObjectURL` - Blob handling

### Supported Browsers
- Chrome 78+
- Firefox 75+
- Safari 14+
- Edge 79+

## Performance Considerations

### Recording
- Max duration: 60 seconds (configurable)
- Resolution: 1920x1080 (adapts to camera)
- Bitrate: 5 Mbps
- Format: WebM (VP9 + Opus)

### Voice Cloning
- Requires ~10-30 seconds of clear audio
- Processing time: 30-60 seconds
- Voice quality depends on recording clarity

### Video Generation
- Time per video: 2-5 minutes
- Depends on:
  - Video length
  - Background generation method
  - API response times
- Recommended: Process in batches of 10-50

## Error Handling

### Common Issues

1. **Camera access denied**
   - Check browser permissions
   - Ensure HTTPS (required for camera)

2. **Voice cloning fails**
   - Ensure clear audio in recording
   - Check API key validity
   - Verify sufficient audio duration (10+ seconds)

3. **Website screenshot fails**
   - Falls back to AI-generated background
   - Check if website is publicly accessible

4. **Video generation fails**
   - Retry with exponential backoff
   - Log failed contacts for reprocessing

## Best Practices

### Recording Tips
- Use good lighting (face well-lit)
- Minimize background noise
- Speak clearly and at moderate pace
- Frame yourself from chest up
- Look at camera (not screen)

### Script Writing
- Keep under 60 seconds when read
- Use natural language for tokens
- Test with sample data first
- Include clear call-to-action

### Contact Management
- Verify email addresses before import
- Include company names for better personalization
- Segment by industry for relevant backgrounds
- Clean data (no duplicates)

### Campaign Strategy
- Start with small test batch (5-10 contacts)
- Review first few videos before full generation
- Schedule sends to avoid spam filters
- Track engagement metrics

## Future Enhancements

### Planned Features
1. **Real-time preview** - See personalization before generation
2. **A/B testing** - Test different scripts/backgrounds
3. **Analytics dashboard** - Track views, clicks, conversions
4. **Email integration** - Direct SMTP/API sending
5. **CRM integrations** - Salesforce, HubSpot, etc.
6. **Team collaboration** - Multiple users, shared templates
7. **Advanced editing** - Trim, add logos, captions
8. **Multi-language** - Support for international contacts

### API Integrations
1. **SendGrid/Mailgun** - Email delivery
2. **Zapier/Make** - Workflow automation
3. **LinkedIn API** - Profile enrichment
4. **Clearbit** - Company data enhancement
5. **Slack** - Notifications and sharing

## File Structure

```
/components
  ├── VideoRecorder.jsx          # Cap-style recorder
  ├── SendsparkWorkflow.jsx      # 5-step workflow UI
  ├── VideoPersonalizationHub.jsx # Main hub (updated)
  └── ...

/lib
  ├── sendsparkEngine.js         # Core engine
  ├── muapi.js                   # AI service integration
  ├── ttsService.js              # Voice/TTS services
  └── videoEnhancementService.js # Video processing

/pages
  ├── sendspark.js               # Dedicated workflow page
  └── personalize.jsx            # Main hub page

/docs
  └── SENDSPARK_WORKFLOW.md      # This documentation
```

## Support & Troubleshooting

### Debug Mode
Enable debug logging:
```javascript
localStorage.setItem('sendspark_debug', 'true');
```

### Logs Location
Check browser console for:
- Recording status
- API responses
- Processing steps
- Error details

### Getting Help
1. Check browser console for errors
2. Verify API keys are valid
3. Test with minimal data first
4. Review network tab for API calls
5. Contact support with campaign ID

---

**Version:** 1.0.0  
**Last Updated:** April 2026  
**Maintainer:** Development Team