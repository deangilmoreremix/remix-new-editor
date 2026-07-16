# Video Personalization Logic Flow

## 📋 Single Video Creation Process

### **Step 1: Input Validation**
```javascript
function validateInputs(baseVideo, contact, tokens) {
  // 1.1 Validate base video exists and is accessible
  if (!baseVideo || !baseVideo.url) {
    throw new Error('Base video is required');
  }

  // 1.2 Validate contact has required fields
  if (!contact || !contact.email) {
    throw new Error('Contact email is required');
  }

  // 1.3 Validate tokens configuration
  if (!tokens || Object.keys(tokens).length === 0) {
    throw new Error('Token configuration is required');
  }

  return true;
}
```

### **Step 2: Token Replacement Preparation**
```javascript
function prepareTokenReplacements(contact, tokenPatterns) {
  const replacements = {};

  // 2.1 Map token patterns to contact data
  Object.entries(tokenPatterns).forEach(([token, field]) => {
    replacements[token] = contact[field] || '';
  });

  // 2.2 Handle fallback values for missing data
  replacements['{{firstName}}'] = replacements['{{firstName}}'] || 'there';
  replacements['{{company}}'] = replacements['{{company}}'] || 'your organization';

  return replacements;
}
```

### **Step 3: Video Processing Pipeline**
```javascript
async function processVideoPersonalization(baseVideoUrl, replacements) {
  // 3.1 Load base video metadata
  const videoMetadata = await getVideoMetadata(baseVideoUrl);

  // 3.2 Identify text overlays and timestamps
  const textElements = await detectTextElements(videoMetadata);

  // 3.3 Apply token replacements
  const personalizedElements = textElements.map(element => ({
    ...element,
    text: replaceTokens(element.text, replacements)
  }));

  // 3.4 Render personalized video
  const outputUrl = await renderPersonalizedVideo(
    baseVideoUrl,
    personalizedElements,
    videoMetadata
  );

  return outputUrl;
}
```

### **Step 4: Text Token Replacement Logic**
```javascript
function replaceTokens(text, replacements) {
  let processedText = text;

  // 4.1 Replace all token patterns
  Object.entries(replacements).forEach(([token, value]) => {
    const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    processedText = processedText.replace(regex, value);
  });

  // 4.2 Handle conditional text blocks
  processedText = processConditionalBlocks(processedText, replacements);

  // 4.3 Apply text formatting rules
  processedText = applyTextFormatting(processedText);

  return processedText;
}
```

### **Step 5: Video Rendering Process**
```javascript
async function renderPersonalizedVideo(baseVideoUrl, textElements, metadata) {
  // 5.1 Initialize video processor
  const processor = new VideoProcessor({
    input: baseVideoUrl,
    output: generateOutputPath(),
    resolution: metadata.resolution,
    duration: metadata.duration
  });

  // 5.2 Add text overlays
  for (const element of textElements) {
    await processor.addTextOverlay({
      text: element.text,
      position: element.position,
      startTime: element.startTime,
      endTime: element.endTime,
      font: element.font,
      color: element.color,
      size: element.size
    });
  }

  // 5.3 Process and export
  const outputUrl = await processor.render();

  // 5.4 Generate thumbnail
  await processor.generateThumbnail(outputUrl);

  return outputUrl;
}
```

### **Step 6: Quality Assurance & Validation**
```javascript
async function validatePersonalizedVideo(outputUrl, originalContact) {
  // 6.1 Verify video renders correctly
  const videoInfo = await getVideoMetadata(outputUrl);

  // 6.2 Check text readability
  const textElements = await extractTextFromVideo(outputUrl);
  const hasPersonalization = textElements.some(text =>
    text.includes(originalContact.firstName) ||
    text.includes(originalContact.company)
  );

  // 6.3 Validate file integrity
  const fileSize = await getFileSize(outputUrl);
  const isValidSize = fileSize > 0 && fileSize < 500 * 1024 * 1024; // 500MB max

  return {
    isValid: hasPersonalization && isValidSize,
    metadata: videoInfo,
    personalizationFound: hasPersonalization,
    fileSize: fileSize
  };
}
```

## 🔄 Complete Flow Integration

```javascript
async function createPersonalizedVideo(baseVideo, contact, tokenConfig) {
  try {
    console.log(`🎬 Starting personalization for ${contact.email}`);

    // Step 1: Validation
    validateInputs(baseVideo, contact, tokenConfig);

    // Step 2: Prepare replacements
    const replacements = prepareTokenReplacements(contact, tokenConfig);

    // Step 3: Process video
    const outputUrl = await processVideoPersonalization(baseVideo.url, replacements);

    // Step 4: Validate result
    const validation = await validatePersonalizedVideo(outputUrl, contact);

    if (!validation.isValid) {
      throw new Error('Video validation failed');
    }

    // Step 5: Return result
    return {
      id: `video-${contact.email}-${Date.now()}`,
      contact: contact,
      url: outputUrl,
      thumbnail: outputUrl.replace('.mp4', '-thumb.jpg'),
      tokens: replacements,
      metadata: validation.metadata,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Failed to create personalized video for ${contact.email}:`, error);
    throw error;
  }
}
```

## 🎯 Key Technical Considerations

### **Text Detection & Replacement**
- OCR for existing text identification
- Token pattern recognition
- Font and styling preservation
- Positioning and timing accuracy

### **Video Processing Pipeline**
- Frame-by-frame text overlay
- Audio synchronization
- Quality preservation
- Compression optimization

### **Error Handling & Recovery**
- Fallback text for missing data
- Video processing retries
- Validation checkpoints
- Cleanup on failure

### **Performance Optimization**
- Parallel processing for bulk operations
- Memory management for large videos
- Caching for repeated elements
- Progressive loading for previews