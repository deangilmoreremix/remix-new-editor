// [remix] Help content for the Timeline Studio Editor. Not part of CineGen: this is the text behind the hover cards
// (name -> what it is -> how to use it). Entries are looked up by the control's label (title / aria-label / button text).

export interface HelpEntry {
  /** Feature name shown as the card heading. */
  name: string;
  /** One line shown immediately. */
  summary: string;
  /** Full definition: what it does. */
  what: string;
  /** Step-by-step: how to use it. */
  how: string[];
  /** Keyboard shortcut, if there is one. */
  shortcut?: string;
}

const e = (name: string, summary: string, what: string, how: string[], shortcut?: string): HelpEntry => ({ name, summary, what, how, shortcut });

/** Exact labels (lower-case, shortcut suffix removed). */
/** Structural elements without a text label, matched by CSS selector. */
export const SELECTOR_HELP: Array<[string, string | ((el: Element) => string)]> = [
  ['.timeline-bottom-bar__zoom-slider', (el) => (el.parentElement && el.parentElement.querySelectorAll('.timeline-bottom-bar__zoom-slider')[0] === el ? 'track height' : 'timeline zoom')],
  ['.clip-card', 'timeline clip'],
  ['.timeline-tabs__tab', 'timeline tab'],
  ['.timeline-editor__ruler-row', 'timeline ruler'],
  ['.track-row__label-text', 'track name'],
  ['.mp__asset-item', 'media pool item'],
];

export const HELP: Record<string, HelpEntry> = {
  // ── Edit tools (left rail) ───────────────────────────────────────────────
  'selection tool': e('Selection tool', 'Select, move and trim clips.',
    'The default tool. Click a clip to select it, drag it to move it along the timeline or to another track, and drag its left or right edge to trim it. Shift-click or drag a box to select several clips at once.',
    ['Click a clip to select it (its properties open in the inspector).', 'Drag the clip body to move it; drag an edge to trim in or out.', 'Press Delete to remove the selection.'], 'V'),
  'blade tool': e('Blade tool', 'Cut a clip in two.',
    'Splits a clip at the point you click, leaving two separate clips. Nothing is deleted, so you can still trim either half back out.',
    ['Choose the Blade tool (or press B).', 'Hover over a clip: a line shows where the cut will land.', 'Click to cut. Press V to go back to the Selection tool.'], 'B'),
  'ripple trim': e('Ripple trim', 'Trim a clip and close the gap automatically.',
    'Trimming a clip edge normally leaves a gap. With ripple trim, every clip after the edit shifts left or right so the timeline stays gap-free.',
    ['Choose Ripple trim (or press R).', 'Drag the edge of a clip.', 'Clips after it on the track move with the edge, keeping the sequence tight.'], 'R'),
  'roll trim': e('Roll trim', 'Move the cut point between two clips.',
    'Changes where one clip ends and the next begins without changing the total length of the timeline. One clip gets shorter while its neighbour gets longer by the same amount.',
    ['Choose Roll trim (or press N).', 'Drag the cut between two touching clips left or right.', 'The overall timeline length stays the same.'], 'N'),
  'slip': e('Slip', 'Change which part of a clip shows, without moving it.',
    'Keeps the clip in the same place and the same length, but shifts the footage inside it. Use it to pick a different moment of the shot while the edit stays put.',
    ['Choose Slip (or press Y).', 'Drag inside a clip left or right.', 'The clip keeps its position and duration; only the visible part of the source changes.'], 'Y'),
  'slide': e('Slide', 'Move a clip while its neighbours absorb the change.',
    'Moves a clip earlier or later on the timeline. The clip before it gets shorter or longer and the clip after it adjusts, so the overall length does not change.',
    ['Choose Slide (or press U).', 'Drag the clip left or right.', 'The neighbouring clips trim to fill the space; the footage inside the clip is unchanged.'], 'U'),
  'music tool': e('Music tool', 'Generate AI music for a stretch of the timeline.',
    'Drag across an audio track to mark where music should go. A placeholder appears; click it to open the music generator, choose genre, mood, style and tempo (or describe it), and generate a track that fits that length. Needs your MuAPI key in Settings.',
    ['Choose the Music tool (or press M).', 'Drag a range on an audio track.', 'Click "Click to Generate" on the placeholder, set genre/mood/style/tempo or write a prompt.', 'Turn on "Analyze Video" to base the music on the footage, then press Generate.'], 'M'),
  'fill gap tool': e('Fill Gap tool', 'Generate AI footage to bridge a gap between two clips.',
    'Finds the empty space between two clips on a video track and creates a new clip that transitions from the last frame of the left clip to the first frame of the right clip. Needs your MuAPI key in Settings.',
    ['Choose the Fill Gap tool.', 'Hover over a gap on a video track: a "Fill Gap" tile appears.', 'Click the gap, then click "Generate AI Fill" on the placeholder.', 'Describe what should happen in the gap and press Generate.']),
  'extend tool': e('Extend tool', 'Make a clip longer with AI-generated footage.',
    'Continues a clip past its last frame (or before its first frame) by generating new video that picks up from that frame, up to 10 seconds at a time. Needs your MuAPI key in Settings.',
    ['Choose the Extend tool (or press E).', 'Drag from the end (or start) of a clip into empty space.', 'Click "Generate Extension" on the placeholder.', 'Pick a model, describe what should happen next and press Generate.'], 'E'),
  'mask tool': e('Mask tool', 'Cut a subject out of a clip.',
    'Opens the clip in the source viewer with an on-device segmentation tool. Mark the subject with text, a click or a box, preview the mask on the current frame, then track it across the whole clip and insert the result on the timeline.',
    ['Choose the Mask tool (or press X) with a clip selected.', 'Pick Text, Click or Box and mark the subject.', 'Preview the mask on the current frame.', 'Press "Track Clip" to follow it through the clip, then "Insert Clip".'], 'X'),
  'sound effects library': e('Sound effects library', 'Browse and add ready-made sounds.',
    'Opens a searchable library of sound effects grouped by category. Preview any sound and add it to the timeline at the playhead.',
    ['Open the library and search or pick a category.', 'Press the play button on a sound to hear it.', 'Press Add to place it on an audio track at the playhead.']),
  'record a voice-over at the playhead': e('Record voice-over', 'Record your microphone straight onto the timeline.',
    'Records from your microphone and places the recording on an audio track starting at the playhead. Your browser will ask for microphone permission the first time.',
    ['Move the playhead to where the voice-over should start.', 'Press the microphone button and allow microphone access.', 'Speak, then press it again (it shows "Stop recording") to finish.']),
  'stop recording': e('Stop recording', 'Finish the voice-over and add it to the timeline.', 'Stops the microphone recording and places the audio clip on the timeline where you started.', ['Press the button again to stop.']),

  // ── Transport / viewer ───────────────────────────────────────────────────
  'play': e('Play', 'Play the timeline from the playhead.', 'Starts playback of the timeline at the current position.', ['Press the button or the Space bar.'], 'Space'),
  'pause': e('Pause', 'Pause playback.', 'Stops playback and leaves the playhead where it is.', ['Press the button or the Space bar again.'], 'Space'),
  'go to start': e('Go to start', 'Jump to the beginning of the timeline.', 'Moves the playhead to 00:00:00:00.', ['Press the button.']),
  'go to end': e('Go to end', 'Jump to the end of the timeline.', 'Moves the playhead to the end of the last clip.', ['Press the button.']),
  'step back': e('Step back', 'Move back one frame.', 'Moves the playhead back a single frame, useful for exact cuts.', ['Press the button, or use the Left arrow key.']),
  'step forward': e('Step forward', 'Move forward one frame.', 'Moves the playhead forward a single frame, useful for exact cuts.', ['Press the button, or use the Right arrow key.']),
  'dual viewer': e('Dual viewer', 'Show a source viewer next to the timeline viewer.', 'Splits the preview into two: the Clip Viewer (the raw source of whichever clip or asset you opened) and the Timeline Viewer (the edited result). Handy for choosing In and Out points and for the Mask tool.',
    ['Press the button, or double-click a clip or a media-pool item.', 'Press it again ("Single viewer") to return to one viewer.']),
  'single viewer': e('Single viewer', 'Show only the timeline viewer.', 'Hides the source viewer so the timeline preview uses the full width.', ['Press the button.']),
  'show inspector': e('Inspector', 'Open the properties panel for the selected clip.', 'The side panel with every setting of the selected clip: speed, opacity, volume, flip, position and scale, keyframes, transitions, effects, colour looks (LUTs), captions and more.',
    ['Select a clip on the timeline.', 'Press the button to show or hide the panel.', 'Change any value; the preview updates immediately.']),
  'hide inspector': e('Inspector', 'Close the properties panel.', 'Hides the side panel so the viewer is larger.', ['Press the button.']),

  // ── Media pool ───────────────────────────────────────────────────────────
  'import media files': e('Import media', 'Add video, audio or images to the project.', 'Opens a file picker. Imported files appear in the media pool and can be dragged onto the timeline. They stay in your browser; nothing is uploaded unless you use an AI tool that needs it.',
    ['Press the button and choose files (you can pick several).', 'Drag an asset from the media pool onto a track.']),
  'new folder': e('New folder', 'Group assets in a folder.', 'Creates a folder in the media pool so large projects stay organised.', ['Press the button and name the folder.', 'Drag assets into it.']),
  'delete selected item': e('Delete from media pool', 'Remove the selected asset.', 'Removes the selected asset (or folder) from the media pool. Clips already on the timeline that use it are affected, so check before deleting.', ['Select an asset in the pool.', 'Press the button.']),
  'sort by': e('Sort', 'Choose how the media pool is ordered.', 'Orders assets by date, name or type.', ['Open the menu and choose a sort order.']),
  'thumbnail size': e('Thumbnail size', 'Make media-pool thumbnails bigger or smaller.', 'Slides the size of the thumbnails in the grid view.', ['Drag the slider.']),
  'grid view': e('Grid view', 'Show assets as thumbnails.', 'Displays the media pool as a grid of thumbnails.', ['Press the button.']),
  'list view': e('List view', 'Show assets as a list.', 'Displays the media pool as rows with name, type and duration.', ['Press the button.']),
  'compact': e('Compact / Full', 'Shrink or expand the media pool.', 'Toggles between a compact media pool and a full-height one.', ['Press the button.']),
  'search assets...': e('Search assets', 'Find a clip by name.', 'Filters the media pool as you type.', ['Click the box and type part of a name.']),

  // ── Timeline bar & tracks ────────────────────────────────────────────────
  'new timeline': e('New timeline', 'Add another timeline to the project.', 'Creates an empty timeline in a new tab. A project can hold several versions or sequences.', ['Press the + button next to the timeline name.', 'Switch between timelines with the tabs.']),
  'snap': e('Snap', 'Make clips stick to edges and the playhead.', 'When on, clips and edits snap to nearby clip edges, markers and the playhead so things line up exactly. Turn it off for free placement.', ['Press the button to turn snapping on or off.'], 'S'),
  'add marker': e('Add marker', 'Drop a flag at the playhead.', 'Places a marker on the ruler at the current position to remember a spot (a beat, a cut, a note).', ['Move the playhead.', 'Press the button or M.'], 'M'),
  'add track': e('Add track', 'Add a new video or audio track.', 'Adds another layer. Higher video tracks appear on top of lower ones; audio tracks mix together.', ['Press the button and choose video or audio.']),
  'lock track': e('Lock track', 'Protect a track from edits.', 'A locked track cannot be moved, trimmed or cut, so you cannot damage it by accident.', ['Press the lock icon on the track header. Press again to unlock.']),
  'mute': e('Mute track', 'Silence a track.', 'Turns the track’s audio (or hides it for video) without deleting anything.', ['Press M on the track header. Press again to restore.']),
  'solo': e('Solo track', 'Hear only this track.', 'Mutes every other track so you can focus on one.', ['Press S on the track header. Press again to restore everything.']),
  'remove': e('Remove', 'Delete this item.', 'Removes the track, switch or item this button belongs to.', ['Press the button. Use Undo if it was a mistake.']),
  'fit tracks to view': e('Fit tracks to view', 'Resize track height to fit the screen.', 'Adjusts the height of the tracks so all of them are visible without scrolling.', ['Press the button.']),
  'fit timeline to view': e('Fit timeline to view', 'Zoom the whole timeline into view.', 'Changes the horizontal zoom so the full length of the timeline fits on screen.', ['Press the button.']),
  'add an overlay at the playhead': e('Add overlay', 'Place a form, button or motion graphic over the video.', 'Overlays are interactive or graphic elements drawn on top of the picture: call-to-action buttons, lead forms, end screens, motion-graphics templates and more. They have their own lane under the ruler.',
    ['Move the playhead to where it should appear.', 'Open "Add overlay…" and choose a type.', 'Edit its text and style in the inspector; drag it on the lane to time it.']),
  'remove clip': e('Remove clip', 'Take this clip off the timeline.', 'Deletes the clip from the timeline. The original file stays in the media pool, so you can drag it back in. Works for video, audio, images and generated placeholders.', ['Press the × on the clip (it shows on hover and while the clip is selected), or select it and press Delete.', 'Use Undo (Ctrl/Cmd + Z) to bring it back.']),
  'remove marker': e('Remove marker', 'Delete this marker.', 'Removes the marker flag from the ruler. It does not change any clips.', ['Press the × beside the flag, or right-click the marker and choose Remove.']),
  'remove overlay': e('Remove overlay', 'Take this overlay off the timeline.', 'Deletes the overlay (lead form, button, graphic, motion template or end screen) from the timeline and the video. Use Undo to bring it back.', ['Press the × on its block, or select it and press Delete.']),
  'remove caption': e('Remove caption', 'Delete this caption.', 'Removes this single caption line from the clip. The other captions are not affected. Use Undo to bring it back.', ['Press the × on the caption block, or select it and press Delete.']),
  'overlays: forms and buttons drawn over the video': e('Overlay lane', 'Timing for forms, buttons and graphics.', 'This lane shows every overlay as a block. Drag a block to change when it appears, drag its edges to change how long it stays, and click it to edit it.', ['Click a block to select it.', 'Drag to move, drag the edges to resize.']),

  // ── Project Manager ──────────────────────────────────────────────────────
  'new project': e('New project', 'Start an empty project.', 'Creates a new project and opens it in the editor. Projects are saved in your browser automatically.', ['Press the button, type a name and press Enter.']),
  'delete project': e('Delete project', 'Remove this project.', 'Deletes the project from this browser. Export a backup first if you may need it again; this cannot be undone.', ['Press the bin icon on the project card and confirm.']),

  // ── Header / shell ───────────────────────────────────────────────────────
  'back to projects': e('Projects', 'Return to the Project Manager.', 'Saves your work and goes back to the list of projects.', ['Press the home icon.']),
  'settings': e('Settings', 'Keys, preferences and defaults.', 'Where you add your MuAPI and OpenAI keys, and set project defaults such as resolution, frame rate and aspect ratio.', ['Press the gear icon.']),
  'assistant': e('Assistant', 'Ask the AI to help edit.', 'A chat assistant that can look at your project and make edits for you, such as trimming, reordering and adding titles. You approve changes. Needs your OpenAI key.', ['Open it and describe what you want.', 'Review the proposed change and accept or undo it.']),
  'voice director': e('Voice Director', 'Speak commands to the editor.', 'Hold a key and talk: the editor turns your speech into edits and navigation. Needs your OpenAI key and microphone permission.', ['Press ⌘/Ctrl + Shift + Space.', 'Say what you want, for example "cut here" or "go to the end".'], '⌘⇧Space'),
  'update api key': e('API keys', 'Add or change your provider keys.', 'Opens Settings so you can enter the key AI features use. Keys stay in your browser.', ['Press the button and paste your key.']),
  'elements': e('Elements', 'Reusable characters, locations, props and vehicles.', 'A library of subjects with reference images so they look the same in every shot.', ['Open the tab.', 'Press New Element and fill in the form.']),
  'spaces': e('Spaces', 'Node canvas for AI generation.', 'Build image, video and audio pipelines by connecting nodes. Press Space on the canvas to add a node.', ['Open the tab and press Space to add nodes.', 'Connect outputs to inputs and press Run.']),
  'director': e('Director', 'Turn a script into shots.', 'Paste or upload a script and it breaks it into scenes, a shot list and generated takes you can send to the timeline.', ['Open the tab and paste your script.', 'Follow the steps: Script, Look Bible, Breakdown, Shotlist, Generate.']),
  'edit': e('Edit', 'The timeline editor.', 'Where you arrange clips, trim, add effects and overlays.', ['Open the tab to edit your timeline.']),
  'llm': e('LLM', 'Chat with an assistant about your footage.', 'Ask questions about your clips, plan cuts, search transcripts and run editing skills. Needs your OpenAI key.', ['Open the tab and choose a mode (Ask, Search, Cut, Timeline).']),
  'export': e('Export', 'Render the timeline to a video file.', 'Choose quality, frame rate and aspect ratio, then render an MP4 you can download.', ['Open the tab.', 'Pick a preset, frame rate and aspect ratio.', 'Press Render.']),

  // ── Inspector & keyframes ────────────────────────────────────────────────
  'record the current values as a keyframe at the playhead': e('Add keyframe', 'Save this value at this moment.', 'A keyframe stores a property value at a point in time. Add one at two different times with different values and the editor animates between them.',
    ['Move the playhead.', 'Change the value you want to animate.', 'Press the diamond to record it; repeat at another time.']),
  'add a keyframe at the playhead': e('Add keyframe', 'Save this value at this moment.', 'Stores the property’s current value as a keyframe at the playhead.', ['Move the playhead, set the value, press the diamond.']),
  'update the keyframe at the playhead': e('Update keyframe', 'Change the saved value at this moment.', 'The playhead is on an existing keyframe; pressing this updates its value.', ['Change the value, then press the diamond.']),
  'clear all keyframes of this property (keeps the value at the playhead)': e('Clear keyframes', 'Stop animating this property.', 'Removes all keyframes of this property and keeps the value from the playhead position as a fixed value.', ['Press the button.']),
  'blend mode': e('Blend mode', 'How this clip mixes with the layer beneath.', 'Normal simply covers the layer below. Modes such as Screen, Multiply, Overlay or Add combine the colours for glow, shadow and light-leak looks.', ['Pick a mode from the list; the preview updates.']),
  'fill mode': e('Fill mode', 'How the clip fills the frame.', 'Contain shows the whole picture with bars if the shapes differ. Cover fills the frame and crops the edges.', ['Choose Contain or Cover.']),
  'fill the bars with a blurred copy of the clip': e('Blurred background', 'Fill the empty bars with a soft copy of the clip.', 'When the clip does not fill the frame, the bars are filled with a blurred, darkened copy of the same picture instead of black.', ['Turn it on when a clip shows black bars.']),
  'how pictures fill the frame (clips can override this)': e('Picture fit', 'Project-wide default for fitting pictures.', 'Contain keeps the whole picture visible; Cover fills the frame and crops. Individual clips can override it.', ['Choose Contain or Cover.']),
  'follow subject': e('Follow subject', 'Keep a moving subject in frame.', 'Tracks a person or object through the clip and moves and zooms the picture so the subject stays framed, handy when reframing wide footage to vertical.', ['Select the clip and turn it on.', 'Pick the subject if asked; the preview follows it.']),
  'effects library': e('Effects library', 'Browse visual effects, looks and transitions.', 'A catalogue of effects (blur, glow, glitch, colour grades and more), LUT looks and transitions you can apply to the selected clip or cut.', ['Open the library.', 'Click an effect to apply it to the selected clip.']),
  'add effect': e('Add effect', 'Apply a visual effect to the clip.', 'Adds an effect to the selected clip. Effects stack and can be reordered, switched off or adjusted with sliders.', ['Select a clip.', 'Press Add effect and choose one.', 'Adjust its sliders in the inspector.']),
  'lut': e('LUT (colour look)', 'Apply a colour grade.', 'A LUT remaps colours to give a cinematic look. Built-in looks are included, or import your own .cube file.', ['Choose a look from the list.', 'Use the intensity slider to blend it in.']),
  'import .cube lut': e('Import LUT', 'Use your own colour grade.', 'Loads a .cube lookup table from your computer and adds it to the list of looks.', ['Press the button and choose a .cube file.']),
  'transition type': e('Transition', 'How one clip changes into the next.', 'Choose a cut, fade or a shader transition (wipes, glitch, page curl and more) for the join between two clips.', ['Select the cut between two clips.', 'Pick a type and set its duration.']),
  'new transition type': e('Transition', 'How one clip changes into the next.', 'Choose the style of transition used at this cut.', ['Pick a type from the list.']),
  'remove transition': e('Remove transition', 'Go back to a plain cut.', 'Deletes the transition at this cut.', ['Press the button.']),
  'layout': e('Layout', 'Arrange several clips on screen.', 'Presets that place the selected clips side by side, in a grid or picture-in-picture.', ['Select two or more clips on different video tracks.', 'Choose a layout.']),
  'zoom shape': e('Zoom', 'Animate a push-in or pull-out.', 'Adds a smooth zoom that scales about a focal point over the clip, in a chosen shape and strength.', ['Choose a zoom shape.', 'Adjust the focus point and strength.']),
  'caption style': e('Caption style', 'Look of the subtitles.', 'Sets the font, colours, outline and layout of the captions on this clip.', ['Choose a preset, then fine-tune the font and colours.']),
  'caption preset': e('Caption preset', 'One-click caption look.', 'A ready-made combination of font, colour, motion and position for captions.', ['Pick a preset.']),
  'caption font': e('Caption font', 'Typeface for captions.', 'Chooses the font used for the captions. You can import your own fonts.', ['Pick a font from the list.']),
  'caption motion': e('Caption motion', 'How captions appear.', 'Animates captions word by word or line by line (pop, slide, highlight and more).', ['Pick a motion.']),
  'caption language': e('Caption language', 'Language of the transcript.', 'The spoken language used to transcribe the clip.', ['Choose the language, then generate captions.']),
  'bilingual language': e('Translate captions', 'Show a second language.', 'Translates the captions and shows them under the original line. Needs your OpenAI key.', ['Pick a language.']),
  'captions: drag to move, drag edges to trim, shift-click to select several, delete, ctrl/cmd+c / v': e('Caption lane', 'Edit caption timing.', 'Each block is one caption. Drag to move it, drag an edge to change its length, Shift-click to select several, Delete to remove and Ctrl/Cmd+C / V to copy and paste.', ['Click a caption block and drag.']),
  'brand style': e('Brand style', 'Reuse a caption look.', 'Saves your caption styling as a named look you can apply to other clips.', ['Style the captions, then save it as a look.']),
  'delete a saved look': e('Delete saved look', 'Remove a saved style.', 'Deletes a look you saved earlier. It does not change clips that already use it.', ['Press the button next to the saved look.']),
  'keep these cameras together so switches can be revised later': e('Multicam group', 'Link angles of the same shoot.', 'Groups synchronised camera clips so you can switch between angles and change those switches later.', ['Select the camera clips.', 'Turn it on, then switch angles from the playhead.']),
  'switch to this camera from the playhead': e('Switch camera', 'Cut to this angle here.', 'From the playhead onward, show this camera instead of the current one.', ['Move the playhead to the cut.', 'Press the camera.']),
  'remove this switch': e('Remove switch', 'Undo a camera change.', 'Deletes the camera switch so the previous angle continues.', ['Press the button.']),
  'sync: move this camera 1 frame earlier': e('Nudge earlier', 'Fine-tune camera sync.', 'Moves this camera one frame earlier so it lines up with the others.', ['Press until the audio and picture match.']),
  'sync: move this camera 1 frame later': e('Nudge later', 'Fine-tune camera sync.', 'Moves this camera one frame later so it lines up with the others.', ['Press until the audio and picture match.']),
  'motion graphics templates': e('Motion graphics', 'Animated titles and graphics.', 'A browser of ready-made animated templates (titles, lower thirds, call-outs) with editable text and colours.', ['Open the browser and pick a template.', 'Edit its text in the inspector; it is added as an overlay.']),
  'clap audio tagging (genre, mood, instruments, usage). optional: downloads a model from hugging face the first time.': e('Audio tagging', 'Describe what a sound is.', 'Analyses the clip’s audio and tags the genre, mood and instruments. The first use downloads a small model to your browser.', ['Press the button and wait for the tags.']),
  'neural beat + downbeat tracker. optional: downloads an ≈83 mb model from hugging face the first time.': e('Beat tracking', 'Find the beats in music.', 'Detects beats and downbeats so you can cut to the rhythm. The first use downloads a model (about 83 MB).', ['Press the button, then use the beats as snap points.']),
  "uses openchatcut's silero voice-activity model, so speech is never marked as silence": e('Silence detection', 'Find quiet parts safely.', 'Marks pauses using a speech-detection model so speech is never cut by mistake. Use it to remove dead air.', ['Run the analysis, then review and delete the quiet sections.']),

  // ── Inspector (selected clip) ────────────────────────────────────────────
  'flip h': e('Flip horizontal', 'Mirror the picture left to right.', 'Flips the clip like a mirror. Useful to change the direction a subject faces or to fix selfie footage.', ['Select a clip and press the button; press again to undo it.']),
  'flip v': e('Flip vertical', 'Turn the picture upside down.', 'Flips the clip top to bottom.', ['Select a clip and press the button; press again to undo it.']),
  'rate': e('Speed', 'Play the clip faster or slower.', 'Changes the playback rate. Below 1× is slow motion, above 1× is fast. The clip gets shorter or longer on the timeline to match, and audio is stretched with it.', ['Drag the slider (or type a value).', 'Use Reset to return to normal speed.']),
  'level': e('Volume', 'How loud the clip is.', 'Sets the clip’s volume. 100% is the original level; drag higher to boost or lower to reduce. For fades, use keyframes.', ['Drag the slider.', 'Use the diamond to animate it over time.']),
  'in': e('In point', 'Where the clip starts in its source.', 'The first moment of the source file that plays. Raising it trims the start of the clip.', ['Drag the slider or type a time.']),
  'out': e('Out point', 'Where the clip ends in its source.', 'The last moment of the source file that plays. Lowering it trims the end of the clip.', ['Drag the slider or type a time.']),
  'opacity': e('Opacity', 'How see-through the clip is.', 'At 100% the clip is solid; lower values let the layers underneath show through. Animate it with keyframes for fades.', ['Drag the slider.', 'Add keyframes to fade in or out.']),
  'browse library…': e('Browse effects library', 'Open the full effects catalogue.', 'Opens the library of visual effects, looks and transitions with previews.', ['Press the button and click an effect to apply it.']),
  'generate captions': e('Generate captions', 'Create subtitles from the speech.', 'Transcribes the clip’s audio on your device and creates timed captions you can style and edit.', ['Select a clip with speech.', 'Press Generate captions and wait for the transcript.', 'Pick a caption style and edit any words that are wrong.']),
  'import .srt': e('Import SRT', 'Use subtitles you already have.', 'Loads a .srt subtitle file and turns it into captions for this clip.', ['Press the button and choose a .srt file.']),
  'position x': e('Position X', 'Move the clip left or right.', 'Offsets the picture horizontally inside the frame.', ['Drag the slider or type a value.', 'Use the diamond to animate movement.']),
  'position y': e('Position Y', 'Move the clip up or down.', 'Offsets the picture vertically inside the frame.', ['Drag the slider or type a value.']),
  'scale': e('Scale', 'Make the picture bigger or smaller.', 'Zooms the picture in or out around its centre. Above 100% crops the edges; below shows more of the frame behind it.', ['Drag the slider.', 'Animate it with keyframes for a push-in.']),
  'rotation': e('Rotation', 'Turn the picture.', 'Rotates the clip around its centre, in degrees.', ['Drag the slider or type an angle.']),
  'fit': e('Fit', 'How this clip fills the frame.', 'Contain shows the whole picture (with bars if the shapes differ). Cover fills the frame and crops the edges. This overrides the project default for this clip only.', ['Choose Contain or Cover.']),
  'crop left': e('Crop left', 'Trim the left edge of the picture.', 'Hides part of the picture from the left side, without changing the clip’s length.', ['Drag the slider.']),
  'crop right': e('Crop right', 'Trim the right edge of the picture.', 'Hides part of the picture from the right side.', ['Drag the slider.']),
  'crop top': e('Crop top', 'Trim the top edge of the picture.', 'Hides part of the picture from the top.', ['Drag the slider.']),
  'crop bottom': e('Crop bottom', 'Trim the bottom edge of the picture.', 'Hides part of the picture from the bottom.', ['Drag the slider.']),
  'reset': e('Reset', 'Put these values back to normal.', 'Returns this group of settings to their defaults. Keyframes you added are kept unless you clear them.', ['Press the button.']),
  '◇ add keyframe': e('Add keyframe', 'Save this value at this moment.', 'A keyframe stores a value at a point in time; two keyframes with different values make the editor animate between them.', ['Move the playhead, set the value, press the button; repeat at another time.']),
  'follow subject…': e('Follow subject', 'Keep a moving subject in frame.', 'Tracks a person or object through the clip and moves and zooms the picture so the subject stays framed.', ['Press the button and mark the subject on the frame.', 'Let it track; the preview follows the subject.']),
  'color scopes': e('Colour scopes', 'Check the clip’s colour and brightness.', 'Shows waveform, vectorscope and histogram views so you can judge exposure and colour objectively, and can suggest an automatic grade.', ['Press the button and read the graphs.', 'Use Auto-grade to apply the suggestion.']),
  'detect scenes': e('Detect scenes', 'Find the cuts inside a long clip.', 'Scans the clip for changes of shot and drops markers so you can split it into scenes.', ['Press the button and wait.', 'Use the markers with the Blade tool.']),
  'find quiet spans': e('Find quiet spans', 'Locate silent parts.', 'Finds stretches where the audio is quiet so you can remove dead air. Treats speech carefully; for safer results use the speech-aware option.', ['Press the button and review the spans.']),
  'find silences (speech-aware)': e('Find silences', 'Locate pauses without cutting speech.', 'Uses a speech-detection model so words are never marked as silence, then lets you remove the pauses.', ['Press the button and review the results.']),
  'normalize to -14 lufs': e('Normalise loudness', 'Match streaming loudness.', 'Adjusts the clip’s volume so it reads about −14 LUFS, a common target for online video, so it is not too quiet or too loud.', ['Press the button.']),
  'beat this (neural, optional)': e('Beat tracking', 'Find the beats in music.', 'Detects beats and downbeats so you can cut to the rhythm. The first use downloads a model.', ['Press the button, then use the beat markers as snap points.']),
  'tag audio (clap, optional)': e('Audio tagging', 'Describe what a sound is.', 'Analyses the audio and tags genre, mood and instruments. The first use downloads a model.', ['Press the button and wait for the tags.']),
  'beat markers': e('Beat markers', 'Drop markers on the beats.', 'Places a timeline marker on each detected beat so edits snap to the rhythm.', ['Run beat tracking first, then press the button.']),
  'translate captions': e('Translate captions', 'Show captions in another language.', 'Translates the captions into the chosen language. Needs your OpenAI key.', ['Pick a language, then press the button.']),
  'cancel': e('Cancel', 'Close without applying.', 'Closes this window and discards what you entered.', ['Press the button or Esc.']),
  'generate': e('Generate', 'Create the result with AI.', 'Sends your settings to the AI model and adds the result to your project. This uses your own provider key and may cost credits.', ['Fill in the options, then press Generate (or Ctrl/Cmd + Enter).']),
  'draft': e('Draft quality', 'Fast, smaller export.', '720p preview-quality render: quick to produce, good for checking the edit.', ['Pick it, then press Render.']),
  'standard': e('Standard quality', 'Everyday export.', '1080p render: the usual choice for sharing online.', ['Pick it, then press Render.']),
  'high quality': e('High quality', 'Largest, sharpest export.', '4K render: best quality, but it takes longer and makes a much bigger file, and may be limited by your browser’s memory.', ['Pick it, then press Render.']),
  'frame rate': e('Frame rate', 'Frames per second of the video.', '24 is cinematic, 30 is standard video, 60 is smooth motion. Match the footage where you can.', ['Choose a value from the list.']),
  'aspect ratio': e('Aspect ratio', 'Shape of the finished video.', '16:9 for YouTube and desktop, 9:16 for Reels/Shorts/TikTok, 1:1 for square posts and 4:5 for feeds.', ['Choose a ratio; the preview and export use it.']),
  'render': e('Render', 'Export the timeline to MP4.', 'Produces the finished video file from everything on the timeline, including effects, captions and overlays. Keep the tab open until it finishes.', ['Check the preset, frame rate and aspect ratio.', 'Press Render and wait for the download.']),

  // ── Generation popups (Music / Fill Gap / Extend) ────────────────────────
  'click to generate': e('Generate music', 'Open the music generator for this range.', 'Opens the music generator for the stretch of audio track you marked. Choose the style or describe the music, then generate.', ['Click it, set genre/mood/style/tempo or write a prompt.', 'Press Generate.']),
  'generate ai fill': e('Generate AI fill', 'Open the gap generator.', 'Opens the window where you describe what should happen in the gap between the two clips and create it with AI.', ['Click it, describe the gap, press Generate.']),
  'generate extension': e('Generate extension', 'Open the extension generator.', 'Opens the window where you describe how the clip should continue and create the extra footage with AI.', ['Click it, pick a model, describe what happens next, press Generate.']),
  'analyze video': e('Analyze video', 'Base the music on the footage.', 'When on, the AI looks at the video under the marked range and suggests music that fits its mood and pace. Needs your OpenAI key.', ['Switch it on before pressing Generate.']),
  'instrumental': e('Instrumental', 'Music without vocals.', 'When on, the music has no singing. Turn it off to allow vocals and lyrics.', ['Switch it on or off.']),
  'genre': e('Genre', 'Musical genre.', 'The style family of the music, such as cinematic, electronic, acoustic or hip-hop.', ['Open the list and pick one (optional).']),
  'mood': e('Mood', 'The feeling of the music.', 'The emotion you want, such as uplifting, tense, calm or dramatic.', ['Open the list and pick one (optional).']),
  'style': e('Style', 'How it is played and produced.', 'Further detail on the production style of the track.', ['Open the list and pick one (optional).']),
  'tempo': e('Tempo', 'How fast the music is.', 'Slow, medium or fast. It sets the pace so the music matches your cuts.', ['Open the list and pick one (optional).']),
  'cloud': e('Cloud model', 'Use a hosted AI model.', 'Runs the request on a hosted model with your provider key. More capable, but your text is sent to the provider.', ['Pick Cloud to use hosted models.']),
  'local': e('Local model', 'Use a model on your computer.', 'Runs on your own device. Private and free, but slower and less capable.', ['Pick Local to stay on-device.']),

  // ── Things you hover on the timeline itself ──────────────────────────────
  'timeline clip': e('Clip', 'A piece of media placed on a track.', 'Each block on a track is a clip: a stretch of a video, audio or image file. Its width is its duration. Selecting one opens its settings in the inspector.',
    ['Click to select; drag to move it; drag an edge to trim.', 'Double-click to open its source in the Clip Viewer.', 'Right-click for more options (copy, delete, link and so on).']),
  'timeline tab': e('Timeline tab', 'One timeline of this project.', 'A project can hold several timelines (for example a long cut and a short cut). Each tab is one of them.', ['Click a tab to switch to it.', 'Double-click to rename it; press + to add another.']),
  'timeline ruler': e('Timeline ruler', 'Click to move the playhead.', 'The time scale above the tracks. The playhead (the vertical line) shows the current moment; clicking or dragging on the ruler moves it.', ['Click or drag on the ruler to jump to a time.', 'Zoom with the sliders at the bottom.']),
  'track name': e('Track', 'A layer on the timeline.', 'V tracks hold video and images (higher tracks are drawn on top); A tracks hold audio. Use the buttons beside the name to lock, mute or solo the track.', ['Double-click the name to rename it.', 'Right-click for track options.']),
  'media pool item': e('Media item', 'A file in your project.', 'A video, audio file or image you imported or generated. Drag it onto a track to use it; double-click it to open it in the Clip Viewer.', ['Drag onto the timeline.', 'Double-click to preview it.', 'Right-click for options.']),
  'track height': e('Track height', 'Make the tracks taller or shorter.', 'Changes how tall each track is in the timeline, so clips show more or less detail.', ['Drag the slider.']),
  'timeline zoom': e('Timeline zoom', 'Zoom the timeline in or out.', 'Changes how much time fits across the screen. Zoom in for frame-accurate edits; zoom out to see the whole project.', ['Drag the slider, or use Fit timeline to view.']),

  // ── Mask / frame tools ───────────────────────────────────────────────────
  'box selection': e('Box select', 'Mark a subject with a rectangle.', 'Draw a box around the subject you want to cut out.', ['Drag a rectangle on the picture.']),
  'invert mask': e('Invert mask', 'Swap inside and outside.', 'Keeps everything except the selected subject.', ['Press the button.']),
  'transparent background': e('Transparent background', 'Preview the cut-out on a checkerboard.', 'Shows the masked result with a transparent background.', ['Press the button.']),
  'red overlay on source': e('Red overlay', 'Show the mask as a red tint.', 'Tints the selected area red on top of the source so you can see it.', ['Press the button.']),
  'white on black': e('White on black', 'Show the mask as a matte.', 'Shows the mask as a white shape on black, useful for checking the edge.', ['Press the button.']),
  'mask cutoff and edge settings': e('Mask edge', 'Soften or tighten the cut-out.', 'Adjusts the threshold and edge softness of the mask.', ['Drag the sliders and watch the preview.']),
  'on-device sam (runs in your browser)': e('On-device masking', 'Cut-outs made in your browser.', 'Uses a segmentation model that runs on your computer, so no footage is uploaded. The first run downloads the model.', ['Mark the subject and press Preview.']),
  'local sam 3 (on-device frame preview + clip tracking)': e('Local SAM 3', 'On-device preview and tracking.', 'Previews the mask on the current frame and tracks it across the clip, all in your browser.', ['Mark the subject, then Preview and Track Clip.']),
  'preview on the current frame, then track across the full clip': e('Preview and track', 'Check, then follow the subject.', 'Shows the mask on this frame first; when it looks right, tracks it through the whole clip.', ['Press Preview, then Track Clip.']),
  'preview or insert the current frame only': e('Current frame', 'Use a single frame.', 'Applies the preview or insert to just the frame you are on.', ['Press the button.']),
  'regenerate the current-frame preview': e('Refresh preview', 'Recompute the mask on this frame.', 'Runs the mask again on the frame you are viewing.', ['Press the button.']),
  'detect objects on the current frame automatically': e('Auto-detect', 'Find objects for you.', 'Detects the objects on this frame so you can pick one instead of drawing.', ['Press the button and pick an object.']),
  'text prompt': e('Text prompt', 'Describe the subject.', 'Type what to cut out, such as "person" or "car".', ['Type a word and press Preview.']),
  'generation prompt': e('Generation prompt', 'Describe what to create.', 'The text the AI uses to generate the new footage or image.', ['Write what you want to see.']),
  'iteration mode': e('Iteration mode', 'Refine step by step.', 'Controls whether new results build on the previous one or start fresh.', ['Pick a mode.']),
  'output type': e('Output type', 'What the tool produces.', 'Chooses the kind of result, such as an image or a video clip.', ['Pick a type.']),
  'model': e('Model', 'Which AI model to use.', 'Different models trade speed, quality and cost. The list shows the models available with your keys.', ['Open the list and pick one.']),
  'frame chat': e('Frame chat', 'Ask about or edit the current frame.', 'Opens a chat about the exact frame you are viewing, to describe it, remix it or send it to a generation.', ['Move to a frame and press the button.']),
  'open full timeline': e('Open full timeline', 'Go to the Edit tab.', 'Opens the complete timeline editor for this project.', ['Press the button.']),
  'open ai assistant': e('Assistant', 'Ask the AI to help.', 'Opens the AI assistant drawer.', ['Press the button.']),
  'open voice director': e('Voice Director', 'Speak commands to the editor.', 'Starts voice control. Needs microphone permission.', ['Press the button and speak.']),
  'open app settings': e('Settings', 'Keys and defaults.', 'Opens the application settings.', ['Press the button.']),
  'open skill builder': e('Skill builder', 'Create reusable AI actions.', 'Lets you describe a repeatable editing task and save it as a skill the assistant can run.', ['Press the button and describe the skill.']),
  'new chat': e('New chat', 'Start a fresh conversation.', 'Clears the context so the assistant starts over.', ['Press the button.']),
  'clear conversation': e('Clear conversation', 'Erase this chat.', 'Deletes the messages in this conversation.', ['Press the button.']),
  'send message': e('Send', 'Send your message.', 'Sends what you typed to the assistant.', ['Press the button or Enter.']),
  'send': e('Send', 'Send your message.', 'Sends what you typed to the assistant.', ['Press the button or Enter.']),
  'collapse sidebar': e('Collapse sidebar', 'Hide the side list.', 'Collapses the side panel to give the main area more room.', ['Press the button.']),
  'type a prompt to enhance': e('Enhance prompt', 'Let AI improve your prompt.', 'Rewrites a short idea into a richer prompt.', ['Type a short prompt, then press Enhance.']),
  'undo': e('Undo', 'Reverse the last change.', 'Steps back through your edits. Redo brings them back.', ['Press the button or Ctrl/Cmd + Z.'], 'Ctrl/Cmd+Z'),
  'close': e('Close', 'Close this panel.', 'Closes the panel without applying anything.', ['Press the button or Esc.']),
  'close library': e('Close library', 'Close the effects library.', 'Hides the effects library.', ['Press the button.']),
  'close sound library': e('Close sound library', 'Close the sounds panel.', 'Hides the sound effects library.', ['Press the button.']),
  'close timeline': e('Close timeline', 'Hide the mini timeline.', 'Collapses the timeline preview at the bottom of Spaces.', ['Press the button.']),
  'search sounds': e('Search sounds', 'Find a sound effect.', 'Filters the sound library by name.', ['Type a word.']),
  'clear all': e('Clear all', 'Remove everything in this list.', 'Clears all items in the list. Use Undo if needed.', ['Press the button.']),
  'fill gap': e('Fill Gap', 'Generate footage for the empty space.', 'Creates AI video that bridges the gap between the clips on either side.', ['Click the tile on the gap, then Generate.']),
  'click to fill this gap': e('Fill this gap', 'Start filling the gap.', 'Creates a placeholder for AI footage in this gap.', ['Click it, then describe what should happen.']),
  'extend clip': e('Extend clip', 'Continue a clip with AI.', 'Generates extra footage that continues the clip.', ['Describe what happens next and press Generate.']),
  'click to select': e('Select', 'Select this item.', 'Selects the item so its settings open.', ['Click it.']),
  'playback mode: auto (original first, switch to proxy if needed)': e('Playback mode', 'Original files first, proxies if needed.', 'In Auto mode the editor plays your original files and automatically switches to lighter proxy copies if playback stutters.', ['Press to switch between Auto, Original and Proxy.']),
  'using proxy files for playback': e('Proxy playback', 'Lighter copies are playing.', 'Plays small proxy copies for smoother editing. Export still uses the originals.', ['Press to switch back to originals.']),
  'using original files for playback': e('Original playback', 'Full-quality files are playing.', 'Plays your original files. Switch to proxies if playback is choppy.', ['Press to use proxies.']),
};

/** Labels that change with state: first match wins. */
const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => HelpEntry]> = [
  [/^background fill:/i, () => HELP['fill the bars with a blurred copy of the clip']],
  [/^auto-reframe/i, () => e('Auto-reframe', 'Re-crop wide footage for another shape.', 'Finds the subject and moves the crop so it stays in frame when you change to a taller or squarer aspect ratio.', ['Choose the target aspect ratio, then press the button.'])],
  [/^\+ add .* keyframe/i, () => HELP['add a keyframe at the playhead']],
  [/^translate captions/i, () => HELP['translate captions']],
  [/^tag audio/i, () => HELP['tag audio (clap, optional)']],
  [/^beat this/i, () => HELP['beat this (neural, optional)']],
  [/^find silences/i, () => HELP['find silences (speech-aware)']],
  [/^normalize to/i, () => HELP['normalize to -14 lufs']],
  [/^snap (on|off)$/i, () => HELP.snap],
  [/^playback mode:/i, () => HELP['playback mode: auto (original first, switch to proxy if needed)']],
  [/^gain\b/i, () => e('Clip gain', 'Volume level of the clip.', 'Shows the clip’s volume in decibels. Drag the line on the clip’s waveform up or down to change it.', ['Drag the gain line or knob on the clip.'])],
  [/^volume:/i, () => e('Track volume', 'Loudness of the whole track.', 'Sets the volume for every clip on this track.', ['Drag the volume control on the track header.'])],
  [/^model:/i, () => HELP.model],
  [/^vision failed|^vision ready|^vision /i, () => e('Visual index', 'Whether the AI has analysed this clip.', 'The AI looks at your footage to understand it so the assistant and search can find moments. It needs your OpenAI key; without one it shows "failed", which does not affect editing.', ['Add your OpenAI key in Settings to analyse your media.'])],
  [/^(enable|disable) /i, (m) => e(`${m[1][0].toUpperCase()}${m[1].slice(1)} effect`, 'Switch this effect on or off.', 'Turns the effect off without deleting it, so you can compare before and after.', ['Press the button.'])],
  [/^(add|update) keyframe/i, () => HELP['add a keyframe at the playhead']],
  [/^clear keyframes/i, () => HELP['clear all keyframes of this property (keeps the value at the playhead)']],
  [/^remove /i, () => HELP.remove],
  [/^(play|stop) /i, () => e('Preview sound', 'Listen before you add it.', 'Plays or stops the preview of this sound.', ['Press the button.'])],
];

const SHORTCUT = /\s*\(([^)]{1,16})\)\s*$/;

/** Normalise a control label for lookup. */
export function helpKey(label: string): { key: string; shortcut?: string } {
  const raw = label.trim();
  const m = raw.match(SHORTCUT);
  const base = (m && !/\s/.test(m[1].trim()) ? raw.replace(SHORTCUT, '') : raw).trim();
  return { key: base.toLowerCase().replace(/\s+/g, ' ').replace(/(\u2026|\.\.\.)$/, '').trim(), shortcut: m && !/\s/.test(m[1].trim()) ? m[1].trim() : undefined };
}

/** Help for a control label, or null if there is none. */
export function resolveHelp(label: string | null | undefined): HelpEntry | null {
  if (!label) return null;
  const { key, shortcut } = helpKey(label);
  const hit = HELP[key];
  if (hit) return shortcut && !hit.shortcut ? { ...hit, shortcut } : hit;
  const base = shortcut ? label.trim().replace(SHORTCUT, '').trim() : label.trim();
  for (const [re, fn] of PATTERNS) {
    const m = base.match(re);
    if (m) {
      const found = fn(m);
      return shortcut && !found.shortcut ? { ...found, shortcut } : found;
    }
  }
  return null;
}

// Keys are looked up without a trailing ellipsis, so store them that way too.
for (const k of Object.keys(HELP)) {
  const n = k.replace(/(\u2026|\.\.\.)$/, '').trim();
  if (n !== k && !HELP[n]) HELP[n] = HELP[k];
}

/** Help for an element that has no text label, by its CSS class. */
export function resolveHelpForElement(el: Element): HelpEntry | null {
  for (const [sel, key] of SELECTOR_HELP) {
    if (el.matches(sel)) return HELP[typeof key === 'function' ? key(el) : key] ?? null;
  }
  return null;
}
