# Studio Pexels Integration — Exact Implementation Plan

## Overview

This document provides the **exact code-level integration plan** for adding Pexels media browsing into every studio. The integration follows a consistent pattern:

1. Add a small "Browse Pexels" button next to the existing upload trigger
2. Open the shared `PexelsBrowser` modal
3. When the user selects media, inject it into the studio's existing input variable
4. Show an `attributionChip` near the reference/preview area

---

## Shared Components (Build Once)

### 1. PexelsBrowser Modal
**File:** `src/components/PexelsBrowser.js`

```js
import { mountStudioChrome } from '../lib/studioChrome.js';
import { createSafeImage, safeSetText } from '../lib/security.js';
import { showToast } from '../lib/loading.js';
import {
  searchPhotos,
  searchVideos,
  getCuratedPhotos,
  getPopularVideos,
  clearPexelsCache,
} from '../lib/pexelsApi.js';

export function openPexelsBrowser({ accept = ['image', 'video'], onSelect, onCancel, title = 'Stock Media' }) {
  // Creates a full-screen modal overlay
  // Contains: filter tabs, search, grid, preview, attribution
  // Calls onSelect(asset) when user clicks "Use in Studio"
  // Calls onCancel() when user closes modal
}
```

### 2. studioPexels Helper
**File:** `src/lib/studioPexels.js`

```js
export async function browsePexels({ accept, onSelect, title }) {
  const { openPexelsBrowser } = await import('../components/PexelsBrowser.js');
  openPexelsBrowser({ accept, onSelect, title });
}
```

### 3. Attribution Chip
**File:** `src/lib/attributionChip.js` (already created)

```js
import { renderAttributionChip } from '../lib/attributionChip.js';
renderAttributionChip(asset, container);
// Renders: 📷 Photo by <name> on Pexels
```

---

## Per-Studio Integration Specifications

### TIER 1: Direct Input Studios

---

#### 1. ImageStudio (`src/components/ImageStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedImageUrls` (array)
- Upload trigger: `picker.trigger` from `createUploadPicker`
- Trigger location: `topRow` div, inside `leftColumn`

**Where Pexels Button Goes:**
Right after the existing `picker.trigger` in the `topRow` controls area.

**Exact Code to Add:**

```js
// After line 145 (after picker.panel is appended)
// Add Pexels browse button
const pexelsBtn = document.createElement('button');
pexelsBtn.type = 'button';
pexelsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden mt-1.5';
pexelsBtn.title = 'Browse stock photos from Pexels';
pexelsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Reference Photo',
    onSelect: (asset) => {
      uploadedImageUrls = [asset.url];
      imageMode = true;
      updateModelBtn();
      updateControlsForModel();
      // Show attribution
      renderAttributionChip(asset, document.getElementById('pexels-attribution'));
    }
  });
};
topRow.appendChild(pexelsBtn);

// Add attribution container (hidden by default)
const attrContainer = document.createElement('div');
attrContainer.id = 'pexels-attribution';
attrContainer.className = 'mt-2';
topRow.appendChild(attrContainer);
```

**UI Enhancement:**
- Small camera/gallery icon button next to upload
- Attribution chip appears below the controls when Pexels image is selected
- Automatically switches to I2I mode

---

#### 2. VideoStudio (`src/components/VideoStudio.js`)

**Current Input Pattern:**
- Image variable: `uploadedImageUrl`
- Video variable: `uploadedVideoUrl`
- Image trigger: `picker.trigger` from `createUploadPicker` (line 104-138)
- Video trigger: `videoPickerBtn` button (line 141-253)

**Where Pexels Button Goes:**
Two buttons:
1. Next to `picker.trigger` for image reference (i2v mode)
2. Next to `videoPickerBtn` for video seed (v2v mode)

**Exact Code to Add:**

```js
// After line 138 (after picker.panel is appended)
// Pexels image browse button (for i2v reference)
const pexelsImageBtn = document.createElement('button');
pexelsImageBtn.type = 'button';
pexelsImageBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden mt-1.5';
pexelsImageBtn.title = 'Browse stock photos for i2v reference';
pexelsImageBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsImageBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Reference Image for Video',
    onSelect: (asset) => {
      uploadedImageUrl = asset.url;
      // Switch to i2v mode
      if (!i2vModels.some(m => m.id === selectedModel)) {
        selectedModel = i2vModels[0]?.id || selectedModel;
      }
      updateModelBtn();
      updateControlsForModel();
      renderAttributionChip(asset, document.getElementById('pexels-image-attribution'));
    }
  });
};
topRow.appendChild(pexelsImageBtn);

// After line 253 (after video picker button)
// Pexels video browse button (for v2v seed)
const pexelsVideoBtn = document.createElement('button');
pexelsVideoBtn.type = 'button';
pexelsVideoBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden mt-1.5';
pexelsVideoBtn.title = 'Browse stock videos for v2v input';
pexelsVideoBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsVideoBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['video'],
    title: 'Select Source Video',
    onSelect: (asset) => {
      uploadedVideoUrl = asset.video_files?.[0]?.link || asset.url;
      // Switch to v2v mode
      if (!v2vModels.some(m => m.id === selectedModel)) {
        selectedModel = v2vModels[0]?.id || selectedModel;
      }
      updateModelBtn();
      updateControlsForModel();
      renderAttributionChip(asset, document.getElementById('pexels-video-attribution'));
    }
  });
};
// Add next to videoPickerBtn
videoPickerBtn.parentNode.insertBefore(pexelsVideoBtn, videoPickerBtn.nextSibling);
```

**Attribution Containers:**
```js
const imageAttrContainer = document.createElement('div');
imageAttrContainer.id = 'pexels-image-attribution';
imageAttrContainer.className = 'mt-1';
topRow.appendChild(imageAttrContainer);

const videoAttrContainer = document.createElement('div');
videoAttrContainer.id = 'pexels-video-attribution';
videoAttrContainer.className = 'mt-1';
// Add near video upload area
```

---

#### 3. CinemaStudio (`src/components/CinemaStudio.js`)

**Current Input Pattern:**
- Variable: `currentSettings.referenceUrl`
- Upload trigger: `uploadPicker.trigger` from `createUploadPicker`
- Reference display: `#reference-thumb` img inside `referencePill`

**Where Pexels Button Goes:**
Right after `uploadPicker.trigger` in the `uploadRow`.

**Exact Code to Add:**

```js
// After line 374 (after uploadRow.appendChild(uploadPicker.panel))
const pexelsRefBtn = document.createElement('button');
pexelsRefBtn.type = 'button';
pexelsRefBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden mt-1.5';
pexelsRefBtn.title = 'Browse reference scene from Pexels';
pexelsRefBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsRefBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Reference Scene',
    onSelect: (asset) => {
      currentSettings.referenceUrl = asset.src?.large || asset.url;
      showReferenceThumb(asset.src?.large || asset.url);
      // Switch to i2v models
      if (!i2vModels.some(m => m.id === currentSettings.model)) {
        currentSettings.model = i2vModels[0]?.id || currentSettings.model;
      }
      updateModelBtn();
      updateControlsForModel();
      renderAttributionChip(asset, document.getElementById('pexels-cinema-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsRefBtn);

// Add attribution container
const cinemaAttr = document.createElement('div');
cinemaAttr.id = 'pexels-cinema-attribution';
cinemaAttr.className = 'mt-1';
leftColumn.appendChild(cinemaAttr);
```

**Enhancement to referencePill:**
Update line 395 text to include attribution when Pexels is used:
```js
span.textContent = 'Reference scene loaded — used as the seed for your cinematic shot.';
// When Pexels asset selected:
span.textContent = 'Reference from Pexels — Photo by ' + photographer + ' on Pexels';
```

---

#### 4. EditStudio (`src/components/EditStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedUrl`
- Upload trigger: `picker.trigger` from `createUploadPicker`
- Preview display: `previewImg` element

**Where Pexels Button Goes:**
Right after `picker.trigger` in the `uploadRow`.

**Exact Code to Add:**

```js
// After line 227 (after uploadRow.appendChild(picker.panel))
const pexelsEditBtn = document.createElement('button');
pexelsEditBtn.type = 'button';
pexelsEditBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex flex-col items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsEditBtn.title = 'Browse photos to edit from Pexels';
pexelsEditBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsEditBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Photo to Edit',
    onSelect: (asset) => {
      uploadedUrl = asset.src?.large || asset.url;
      // Update preview
      previewImg.src = uploadedUrl;
      previewImg.classList.remove('hidden');
      clearBtn.classList.remove('hidden');
      // Show attribution
      renderAttributionChip(asset, document.getElementById('pexels-edit-attribution'));
      showToast('Photo loaded from Pexels', 'success');
    }
  });
};
uploadRow.appendChild(pexelsEditBtn);

// Add attribution container
const editAttr = document.createElement('div');
editAttr.id = 'pexels-edit-attribution';
editAttr.className = 'mt-2';
uploadRow.appendChild(editAttr);
```

---

### TIER 2: Timeline & Assembly Studios

---

#### 5. TimelineEditorPage (`src/components/TimelineEditorPage.jsx`)

**Current Input Pattern:**
- Upload: direct `<input type="file" id="uploadInput" accept="video/*,image/*,audio/*,.txt">`
- Media library: `mediaGrid` div with `.media-item` buttons
- Drag-and-drop: items have `draggable="true"` with `data-type` and `data-label`

**Where Pexels Goes:**
Add a new "Stock Media" tab/button in the media library panel alongside Upload, Giphy, Stickers.

**Exact Code to Add:**

```jsx
// In the media library panel (around line 508-513)
// Add before or after the uploadBtn
const pexelsMediaBtn = document.createElement('button');
pexelsMediaBtn.className = 'media-item';
pexelsMediaBtn.draggable = false; // Opens browser instead of drag
pexelsMediaBtn.innerHTML = `
  <div class="media-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  </div>
  <div class="media-copy">
    <div class="media-label">Stock Media</div>
    <div class="media-desc">Browse Pexels</div>
  </div>
`;
pexelsMediaBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image', 'video'],
    title: 'Add Stock Media to Timeline',
    onSelect: async (asset) => {
      // Add directly to timeline
      const mediaType = asset.type === 'video' ? 'video' : 'image';
      const mediaUrl = asset.video_files?.[0]?.link || asset.src?.large || asset.url;
      const duration = asset.duration || 5;
      
      // Use existing addMediaToTimeline or similar
      if (window.addMediaToTimeline) {
        await window.addMediaToTimeline({
          type: mediaType,
          url: mediaUrl,
          thumbnail: asset.image || asset.src?.medium || asset.url,
          duration: duration,
          width: asset.width,
          height: asset.height,
          alt: asset.alt || '',
          photographer: asset.photographer || asset.user?.name || '',
          photographerUrl: asset.photographer_url || asset.user?.url || '',
          source: 'pexels',
        });
        showToast('Added to timeline', 'success');
      }
    }
  });
};
mediaGrid.appendChild(pexelsMediaBtn);
```

**Alternative: Inline Panel Mode**
Instead of a modal, embed the Pexels browser in the media library sidebar:
```jsx
const pexelsPanel = document.createElement('div');
pexelsPanel.className = 'hidden';
// ... embed Pexels browser grid here
// Toggle with pexelsMediaBtn.onclick
```

---

#### 6. DirectorPage (`src/components/DirectorPage.js`)

**Current Input Pattern:**
- No upload UI
- `videoUrl` from URL query params
- Agent operations via `runVideoAgent` / `runAgentAction`

**Where Pexels Goes:**
Add "Add B-Roll from Pexels" button in the B-Roll Adder agent flow.

**Exact Code to Add:**

```js
// In the B-Roll Adder agent section
const pexelsBRollBtn = document.createElement('button');
pexelsBRollBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
pexelsBRollBtn.textContent = '🎬 Browse B-Roll from Pexels';
pexelsBRollBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['video'],
    title: 'Select B-Roll Video',
    onSelect: (asset) => {
      // Add as B-roll overlay
      const brollClip = {
        type: 'video',
        url: asset.video_files?.[0]?.link || asset.url,
        thumbnail: asset.image || '',
        duration: asset.duration || 10,
        width: asset.width,
        height: asset.height,
        source: 'pexels',
        attribution: {
          photographer: asset.user?.name || '',
          photographerUrl: asset.user?.url || '',
          pexelsUrl: asset.url || '',
        }
      };
      // Dispatch event or call existing B-roll adder
      window.dispatchEvent(new CustomEvent('addBRoll', { detail: brollClip }));
      showToast('B-Roll added from Pexels', 'success');
    }
  });
};
// Add to B-Roll Adder UI
```

---

#### 7. VideoAgentPage (`src/components/VideoAgentPage.js`)

**Current Input Pattern:**
- Variable: `videoUrl`
- Upload button: `#load-video-btn`
- File input: `#video-file-input`
- Drag-drop on `#video-preview-stage`

**Where Pexels Goes:**
Add "Use Sample Video" button next to `#load-video-btn`.

**Exact Code to Add:**

```js
// After line 154 (load-video-btn)
const pexelsSampleBtn = document.createElement('button');
pexelsSampleBtn.id = 'pexels-sample-btn';
pexelsSampleBtn.className = 'px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white hover:bg-white/10 transition-all';
pexelsSampleBtn.textContent = '🎬 Use Sample Video';
pexelsSampleBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['video'],
    title: 'Select Sample Video',
    onSelect: (asset) => {
      videoUrl = asset.video_files?.[0]?.link || asset.url;
      // Update preview stage
      const previewStage = document.getElementById('video-preview-stage');
      if (previewStage) {
        previewStage.innerHTML = `
          <video src="${videoUrl}" controls class="w-full h-full object-contain rounded-xl"></video>
        `;
      }
      // Update status
      const status = document.getElementById('load-video-status');
      if (status) status.textContent = 'Loaded from Pexels';
      renderAttributionChip(asset, document.getElementById('pexels-videoagent-attribution'));
      showToast('Sample video loaded from Pexels', 'success');
    }
  });
};
document.getElementById('load-video-btn').parentNode.insertBefore(pexelsSampleBtn, document.getElementById('load-video-btn').nextSibling);
```

---

### TIER 3: Planning & Reference Studios

---

#### 8. StoryboardStudio (`src/components/StoryboardStudio.js`)

**Current Input Pattern:**
- Variable: `frame.referenceImages` (array per frame)
- Upload trigger: `refTrigger` from `createUploadPicker` per frame card
- Reference display: `refThumbWrap` + `refThumb` img

**Where Pexels Goes:**
Add "Reference from Pexels" button next to `refTrigger` on each frame card.

**Exact Code to Add:**

```js
// Inside the frame card creation function, after line 1085 (after refTrigger)
const pexelsRefBtn = document.createElement('button');
pexelsRefBtn.type = 'button';
pexelsRefBtn.className = 'w-8 h-8 shrink-0 rounded-md border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40';
pexelsRefBtn.title = 'Browse reference frame from Pexels';
pexelsRefBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsRefBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Reference Frame',
    onSelect: (asset) => {
      frame.referenceImages = [{
        url: asset.src?.large || asset.url,
        thumbnail: asset.src?.medium || asset.url,
        source: 'pexels',
        attribution: {
          photographer: asset.photographer || '',
          photographerUrl: asset.photographer_url || '',
          pexelsUrl: asset.url || '',
        }
      }];
      // Update UI
      refThumb.src = asset.src?.medium || asset.url;
      refThumbWrap.classList.remove('hidden');
      refRemoveBtn.classList.remove('hidden');
      renderAttributionChip(asset, document.getElementById(`pexels-storyboard-${frameIndex}-attr`));
    }
  });
};
refControls.appendChild(pexelsRefBtn);

// Add attribution container
const storyboardAttr = document.createElement('div');
storyboardAttr.id = `pexels-storyboard-${frameIndex}-attr`;
storyboardAttr.className = 'mt-1';
card.appendChild(storyboardAttr);
```

---

#### 9. CharacterStudio (`src/components/CharacterStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedUrl`
- Upload trigger: `picker.trigger` from `createUploadPicker`

**Where Pexels Goes:**
Add "Browse Character References" button next to upload.

```js
// After line 177 (after picker.panel)
const pexelsCharBtn = document.createElement('button');
pexelsCharBtn.type = 'button';
pexelsCharBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsCharBtn.title = 'Browse character reference photos from Pexels';
pexelsCharBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsCharBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Character Reference',
    onSelect: (asset) => {
      uploadedUrl = asset.src?.large || asset.url;
      renderAttributionChip(asset, document.getElementById('pexels-character-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsCharBtn);

const charAttr = document.createElement('div');
charAttr.id = 'pexels-character-attribution';
charAttr.className = 'mt-2';
uploadRow.appendChild(charAttr);
```

---

#### 10. InfluencerStudio (`src/components/InfluencerStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedUrl`
- Upload trigger: `picker.trigger`

**Where Pexels Goes:**
Add "Browse Backgrounds" button next to upload.

```js
// After line 70 (after picker.panel)
const pexelsBgBtn = document.createElement('button');
pexelsBgBtn.type = 'button';
pexelsBgBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsBgBtn.title = 'Browse backgrounds from Pexels';
pexelsBgBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsBgBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Background',
    onSelect: (asset) => {
      uploadedUrl = asset.src?.large || asset.url;
      renderAttributionChip(asset, document.getElementById('pexels-influencer-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsBgBtn);

const influencerAttr = document.createElement('div');
influencerAttr.id = 'pexels-influencer-attribution';
influencerAttr.className = 'mt-2';
uploadRow.appendChild(influencerAttr);
```

---

#### 11. CommercialStudio (`src/components/CommercialStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedUrl`
- Upload trigger: `picker.trigger`

**Where Pexels Goes:**
Add two buttons: "Browse Product Photos" and "Browse Lifestyle Photos".

```js
// After line 192 (after picker.panel)
const pexelsProductBtn = document.createElement('button');
pexelsProductBtn.type = 'button';
pexelsProductBtn.className = 'px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 transition-all';
pexelsProductBtn.textContent = '📦 Product Photos';
pexelsProductBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Product Photo',
    onSelect: (asset) => {
      uploadedUrl = asset.src?.large || asset.url;
      renderAttributionChip(asset, document.getElementById('pexels-commercial-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsProductBtn);

const pexelsLifestyleBtn = document.createElement('button');
pexelsLifestyleBtn.type = 'button';
pexelsLifestyleBtn.className = 'px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 transition-all';
pexelsLifestyleBtn.textContent = '🌟 Lifestyle Photos';
pexelsLifestyleBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Lifestyle Photo',
    onSelect: (asset) => {
      uploadedUrl = asset.src?.large || asset.url;
      renderAttributionChip(asset, document.getElementById('pexels-commercial-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsLifestyleBtn);

const commercialAttr = document.createElement('div');
commercialAttr.id = 'pexels-commercial-attribution';
commercialAttr.className = 'mt-2';
uploadRow.appendChild(commercialAttr);
```

---

### TIER 4: Enhancement Studios

---

#### 12. EffectsStudio (`src/components/EffectsStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedUrl`
- Upload triggers: `picker.trigger` (desktop) and `mobilePicker.trigger` (mobile)

**Where Pexels Goes:**
Add Pexels button next to both desktop and mobile upload triggers.

```js
// After desktop picker.panel (line 231)
const pexelsFxBtn = document.createElement('button');
pexelsFxBtn.type = 'button';
pexelsFxBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsFxBtn.title = 'Browse photos/videos for effects';
pexelsFxBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsFxBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image', 'video'],
    title: 'Select Media for Effects',
    onSelect: (asset) => {
      uploadedUrl = asset.video_files?.[0]?.link || asset.src?.large || asset.url;
      // Load into inputPreview
      if (inputPreview) {
        inputPreview.src = uploadedUrl;
        inputPreview.classList.remove('hidden');
      }
      renderAttributionChip(asset, document.getElementById('pexels-effects-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsFxBtn);
```

---

#### 13. UpscaleStudio (`src/components/UpscaleStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedUrl`
- Upload trigger: `picker.trigger`

**Where Pexels Goes:**
Add "Browse Photos to Upscale" button.

```js
// After line 175 (after picker.panel)
const pexelsUpscaleBtn = document.createElement('button');
pexelsUpscaleBtn.type = 'button';
pexelsUpscaleBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsUpscaleBtn.title = 'Browse photos to upscale from Pexels';
pexelsUpscaleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsUpscaleBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Photo to Upscale',
    onSelect: (asset) => {
      uploadedUrl = asset.src?.large || asset.url;
      renderAttributionChip(asset, document.getElementById('pexels-upscale-attribution'));
    }
  });
};
uploadRow.appendChild(pexelsUpscaleBtn);

const upscaleAttr = document.createElement('div');
upscaleAttr.id = 'pexels-upscale-attribution';
upscaleAttr.className = 'mt-2';
uploadRow.appendChild(upscaleAttr);
```

---

#### 14. LipSyncStudio (`src/components/LipSyncStudio.js`)

**Current Input Pattern:**
- Variables: `uploadedImageUrl`, `uploadedVideoUrl`, `uploadedAudioUrl`
- Upload triggers: `imageUploadBtn`, `videoUploadBtn`, `audioUploadBtn` (buttons with hidden file inputs)

**Where Pexels Goes:**
Add Pexels browse buttons for image and video (not audio, since Pexels is image/video only).

```js
// After imageUploadBtn (around line 111)
const pexelsLipSyncImageBtn = document.createElement('button');
pexelsLipSyncImageBtn.type = 'button';
pexelsLipSyncImageBtn.className = 'flex-shrink-0 w-14 h-14 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsLipSyncImageBtn.title = 'Browse face image from Pexels';
pexelsLipSyncImageBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsLipSyncImageBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['image'],
    title: 'Select Face Image',
    onSelect: (asset) => {
      uploadedImageUrl = asset.src?.large || asset.url;
      updateImageUploadState('ready');
      renderAttributionChip(asset, document.getElementById('pexels-lipsync-attribution'));
    }
  });
};
// Insert after imageUploadBtn
imageUploadBtn.parentNode.insertBefore(pexelsLipSyncImageBtn, imageUploadBtn.nextSibling);

// Similar for video button after videoUploadBtn
const pexelsLipSyncVideoBtn = document.createElement('button');
// ... same pattern, accept: ['video']
```

---

#### 15. VideoToolsStudio (`src/components/VideoToolsStudio.js`)

**Current Input Pattern:**
- Variable: `uploadedVideoUrl`
- Upload trigger: `videoPicker.trigger` from `createUploadPicker`

**Where Pexels Goes:**
Add "Browse Sample Videos" button.

```js
// After line 174 (after videoPicker.panel)
const pexelsToolsBtn = document.createElement('button');
pexelsToolsBtn.type = 'button';
pexelsToolsBtn.className = 'w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40 group relative overflow-hidden';
pexelsToolsBtn.title = 'Browse sample videos from Pexels';
pexelsToolsBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-secondary group-hover:text-primary"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
pexelsToolsBtn.onclick = async () => {
  const { browsePexels } = await import('../lib/studioPexels.js');
  browsePexels({
    accept: ['video'],
    title: 'Select Video for Tools',
    onSelect: (asset) => {
      uploadedVideoUrl = asset.video_files?.[0]?.link || asset.url;
      renderAttributionChip(asset, document.getElementById('pexels-tools-attribution'));
    }
  });
};
uploadGroup.appendChild(pexelsToolsBtn);

const toolsAttr = document.createElement('div');
toolsAttr.id = 'pexels-tools-attribution';
toolsAttr.className = 'mt-2';
uploadGroup.appendChild(toolsAttr);
```

---

## Implementation Order

### Phase 1: Shared Components (Day 1)
1. ✅ `attributionChip.js` — DONE
2. Build `PexelsBrowser.js` modal
3. Build `studioPexels.js` helper

### Phase 2: Tier 1 Studios (Days 2-3)
4. ImageStudio integration
5. VideoStudio integration
6. CinemaStudio integration
7. EditStudio integration

### Phase 3: Tier 2 Studios (Days 4-5)
8. TimelineEditor integration
9. DirectorPage integration
10. VideoAgentPage integration

### Phase 4: Tier 3 Studios (Day 6)
11. StoryboardStudio integration
12. CharacterStudio integration
13. InfluencerStudio integration
14. CommercialStudio integration

### Phase 5: Tier 4 Studios (Day 7)
15. EffectsStudio integration
16. UpscaleStudio integration
17. LipSyncStudio integration
18. VideoToolsStudio integration

---

## UI Consistency Rules

Every Pexels button across all studios must follow this pattern:

**Button Appearance:**
- Size: `w-10 h-10` (or matching existing upload button size)
- Border: `border border-white/10 hover:border-primary/40`
- Background: `bg-white/5 hover:bg-white/10`
- Icon: Pexels circle+triangle SVG in `text-secondary group-hover:text-primary`
- Tooltip: "Browse [context] from Pexels"

**Attribution Chip:**
- Appears below the upload/reference area
- Compact: `px-3 py-1.5 rounded-lg bg-white/5 border border-white/10`
- Format: `📷 Photo by <name> on Pexels`
- Links to photographer profile and Pexels content page

**Modal Behavior:**
- Full-screen overlay with z-index 100
- Escape and backdrop click to close
- Studio context shown in title: "Select [Context] — Pexels"
- Single action button: "Use in [Studio Name]"

---

## Next Steps

1. Build `PexelsBrowser.js` modal component
2. Build `studioPexels.js` helper
3. Start with ImageStudio as the reference implementation
4. Copy the pattern to all other studios
5. Test each studio independently
6. Verify attribution appears correctly in all contexts
