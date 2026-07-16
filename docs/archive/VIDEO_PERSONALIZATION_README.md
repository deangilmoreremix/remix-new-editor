# Video Personalization Feature

A comprehensive Sendspark-like video personalization platform that allows users to create personalized videos at scale using CSV contact data and token replacement.

## Overview

This feature enables users to:
- Upload base videos for personalization
- Import contact data from CSV files with automatic column mapping
- Manage and customize personalization tokens
- Generate multiple personalized videos in bulk
- Preview and download/share generated videos

## Components

### Core Components

1. **VideoPersonalizationHub** (`components/VideoPersonalizationHub.jsx`)
   - Main orchestrator component that brings together all features
   - Tabbed interface for workflow management
   - State management for the entire personalization process

2. **ContactImporterModal** (`components/modals/ContactImporterModal.jsx`)
   - CSV file upload with drag-and-drop support
   - Automatic column detection and mapping
   - Data validation and duplicate removal
   - 3-step wizard: Upload → Map → Preview → Import

3. **VideoUploader** (`components/VideoUploader.jsx`)
   - Base video upload with file validation
   - Automatic thumbnail generation
   - Support for MP4, MOV, AVI, WebM formats
   - File size limits and progress tracking

4. **VideoPersonalizer** (`components/VideoPersonalizer.jsx`)
   - Bulk video generation engine
   - Token replacement system
   - Progress tracking and video previews
   - Download and sharing capabilities

5. **TokenEditor** (`components/TokenEditor.jsx`)
   - Management of system and custom tokens
   - Add/edit/delete custom personalization tokens
   - Token validation and default values

### Pages

- **Personalize Page** (`pages/personalize.jsx`)
  - Standalone page accessible at `/personalize`
  - Full-screen video personalization interface

## Features

### CSV Contact Import
- **Drag & Drop Upload**: Intuitive file upload interface
- **Auto-Mapping**: Intelligent column detection for common fields (Email, Name, Company, etc.)
- **Manual Mapping**: Override auto-detection for custom column names
- **Validation**: Email format validation and required field checking
- **Duplicate Handling**: Automatic removal of duplicate email addresses
- **Preview**: View imported data before finalizing

### Token System
- **System Tokens**: Pre-defined tokens for common fields
  - `{{email}}` - Contact's email address
  - `{{firstName}}` - Contact's first name
  - `{{lastName}}` - Contact's last name
  - `{{company}}` - Contact's company
  - `{{website}}` - Contact's website
  - `{{linkedin}}` - LinkedIn profile URL
  - `{{phone}}` - Phone number
  - `{{title}}` - Job title
  - `{{industry}}` - Industry
- **Custom Tokens**: User-defined tokens for additional personalization
- **Fallback Values**: Default values when contact data is missing

### Video Generation
- **Bulk Processing**: Generate videos for multiple contacts simultaneously
- **Progress Tracking**: Real-time progress updates during generation
- **Token Replacement**: Dynamic text overlay replacement
- **Video Preview**: Preview generated videos before download
- **Download Options**: Individual and bulk download capabilities
- **Sharing**: Direct sharing links for generated videos

### User Interface
- **Tabbed Workflow**: Step-by-step process guidance
- **Responsive Design**: Works on desktop and mobile devices
- **Progress Indicators**: Visual feedback for all operations
- **Error Handling**: Clear error messages and recovery options
- **Accessibility**: Keyboard navigation and screen reader support

## Usage

### Accessing the Feature

Navigate to `/personalize` in your application to access the video personalization feature.

### Workflow

1. **Upload Base Video**
   - Click "Upload Video" tab
   - Drag & drop or browse for your base video file
   - Supported formats: MP4, MOV, AVI, WebM (max 500MB)

2. **Import Contacts**
   - Click "Import Contacts" tab
   - Upload CSV file with contact information
   - Map CSV columns to contact fields
   - Preview and validate data
   - Import contacts

3. **Manage Tokens** (Optional)
   - Click "Manage Tokens" tab
   - Review system tokens
   - Add custom tokens if needed
   - Set default values

4. **Generate Videos**
   - Click "Generate Videos" tab
   - Review requirements and contacts
   - Click "Generate X Videos" button
   - Monitor progress
   - Preview and download generated videos

### CSV Format Requirements

Your CSV file should include columns for contact information. Common column names are automatically detected:

```csv
Email,First Name,Last Name,Company,Website,LinkedIn Profile
john@example.com,John,Doe,Acme Corp,https://acme.com,https://linkedin.com/in/johndoe
jane@example.com,Jane,Smith,Tech Inc,https://tech.com,https://linkedin.com/in/janesmith
```

### Token Usage

Use tokens in your video scripts, overlays, or any text content:

```
Hello {{firstName}},

Welcome to {{company}}! We're excited to have you join our team.

Visit us at {{website}} or connect on LinkedIn: {{linkedin}}

Best regards,
The Team
```

## Technical Implementation

### Dependencies

The feature uses existing project dependencies:
- React for component structure
- Next.js for page routing
- MobX for state management (if used in existing app)
- File handling via HTML5 File API
- CSS modules for styling

### File Structure

```
components/
├── VideoPersonalizationHub.jsx      # Main hub component
├── VideoUploader.jsx                # Video upload component
├── VideoPersonalizer.jsx            # Video generation component
├── TokenEditor.jsx                  # Token management component
└── modals/
    └── ContactImporterModal.jsx     # Contact import modal

pages/
└── personalize.jsx                  # Standalone page

styles/
└── video-personalization.css        # Feature styles
```

### State Management

The hub component manages the overall state:
- `activeTab`: Current workflow step
- `baseVideo`: Selected base video
- `contacts`: Imported contact list
- `tokens`: Available tokens
- `generatedVideos`: Generated personalized videos

### API Integration

The current implementation includes simulation of video generation. For production use, integrate with:

- **Video Processing API**: Cloud video processing service (AWS MediaConvert, etc.)
- **Storage Service**: Cloud storage for videos (AWS S3, etc.)
- **Email Service**: Send personalized videos via email
- **Analytics**: Track generation metrics

### Security Considerations

- File upload validation (type, size, content)
- Rate limiting for video generation
- Secure token handling
- Access control for generated content
- Data privacy compliance (GDPR, etc.)

## Customization

### Adding New Token Types

Extend the token system by modifying the system tokens in `TokenEditor.jsx`:

```javascript
const systemTokens = {
  '{{email}}': { label: 'Email', type: 'system', required: true },
  '{{yourCustomToken}}': { label: 'Your Custom Field', type: 'system', required: false },
  // ... add more
};
```

### Custom Video Processing

Replace the simulation in `VideoPersonalizer.jsx` with actual API calls:

```javascript
const generatePersonalizedVideo = async (contact, baseVideoUrl) => {
  const response = await fetch('/api/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseVideoUrl,
      contact,
      tokens: allTokens
    })
  });

  return response.json();
};
```

### Styling Customization

Modify `styles/video-personalization.css` to match your brand:
- Color scheme
- Typography
- Layout adjustments
- Responsive breakpoints

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Future Enhancements

- **Video Editor Integration**: Direct editing of base videos
- **Advanced Personalization**: Image overlays, voice cloning
- **Campaign Management**: Organize and track video campaigns
- **Analytics Dashboard**: Generation metrics and performance tracking
- **Team Collaboration**: Multi-user access and approval workflows
- **API Access**: REST API for third-party integrations

## Troubleshooting

### Common Issues

1. **CSV Upload Fails**
   - Check file format (must be .csv)
   - Ensure file is not corrupted
   - Verify column headers exist

2. **Video Generation Errors**
   - Check base video format compatibility
   - Ensure sufficient storage space
   - Verify API endpoints are accessible

3. **Token Replacement Issues**
   - Confirm token syntax (`{{tokenName}}`)
   - Check contact data completeness
   - Verify token mappings

### Debug Mode

Enable debug logging by setting `localStorage.debug = 'video-personalization'` in browser console.

## Contributing

To extend this feature:

1. Follow existing code patterns
2. Add comprehensive error handling
3. Include loading states for async operations
4. Test with various file formats and sizes
5. Update documentation for new features

## License

This feature is part of the VideoRemix application and follows the same licensing terms.