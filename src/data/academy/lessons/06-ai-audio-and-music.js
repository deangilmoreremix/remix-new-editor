// Typed lesson data for the AI Audio & Music Academy track (track 06).
// Structured form powering the LEARN view, derived from the upstream
// markdown in src/content/academy/06-ai-audio-and-music/lessons/*.md.
// Catalog metadata (id, order, title, summary, time, prerequisites,
// relatedTemplateIds, relatedAssetIds) is copied verbatim from catalog.ts.

export const LESSONS_06 = [
  {
    id: '06-ai-audio-and-music::01-voice-cloning-tts',
    slug: '06-ai-audio-and-music::01-voice-cloning-tts',
    order: 1,
    title: 'Voice Cloning & TTS Basics',
    summary: 'A computer reads text; a clone reads the room.',
    time: '~40 minutes',
    prerequisites: [],
    problem:
      'Default TTS sounds robotic: flat pitch, no breathing, zero emotion, and viewers swipe away. Recording yourself does not scale, and you lose the pipeline the moment you are sick. You need a high-fidelity cloned voice that turns text scripts into hours of realistic narration.',
    concept: [
      'Instant Voice Cloning (IVC) needs only 1–5 min of audio — fast and cheap, weaker on emotion and odd pronunciations.',
      'Professional Voice Cloning (PVC) needs 30+ min of studio audio — captures breaths, laughs, and accent for near-indistinguishable output.',
      'Clean capture matters most: cardioid mic 6" away, soft room, mono dry wav with no reverb baked in.',
      'Stability slider trades expressiveness against consistency; clarity/similarity enforces timbre but cracks if maxed.',
      'Keep raw training files isolated so you can re-train if the model drifts or an update changes it.',
      'Never expose your cloned Voice ID publicly — it can be used to burn your API credits.',
    ],
    doIt: [
      'Record 6+ min of varied reading (news, technical, conversational) at consistent volume; 6" from a cardioid mic in a soft room.',
      'Clean in Audacity: noise reduction (~12dB), noise gate at -48dB, normalize peak to -3.0dB; export mono .wav.',
      'Upload to a cloning engine (e.g. ElevenLabs VoiceLab) with a clear label (tone, accent, register).',
      'Generate a 20s test and tune Stability to ~40–45% and Clarity to ~75–80% until it stops sounding robotic.',
      'Log the winning settings per voice so future batches stay consistent.',
    ],
    launchIt: [
      'Sell cloned narration as a per-minute or per-episode line item, not a hobby.',
      'Package a "brand voice" setup: one-time clone build plus ongoing script-to-audio production.',
      'Pitch faceless channels and course creators on consistency and never-losing-their-voice.',
    ],
    exercises: [
      'Easy: record a 1-minute sample and check the dB peak of the silent gaps.',
      'Medium: upload a 3-minute sample, generate a test, and find the slider point where it stops sounding robotic.',
      'Hard: run the full prep (6 min, noise gate below -48dB, mono wav) and train a clone that passes a similarity check.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '06-ai-audio-and-music::voice-studio-clip',
      '06-ai-audio-and-music::voice-studio-setup',
    ],
  },
  {
    id: '06-ai-audio-and-music::02-dubbing-translation',
    slug: '06-ai-audio-and-music::02-dubbing-translation',
    order: 2,
    title: 'AI Dubbing & Translation',
    summary:
      'A video that speaks only one language reaches only a fraction of the world.',
    time: '~45 minutes',
    prerequisites: ['Voice Cloning & TTS Basics'],
    problem:
      'English-only content ignores 80%+ of internet users, but traditional localization is slow and costly: translators, foreign voice actors, studio time, manual timeline alignment. You need a repeatable dub that keeps the speaker’s voice and fits the original timeline.',
    concept: [
      'Tone-preserving dubbing extracts the source timbre and pitch curve, then projects them onto the target-language synth.',
      'Expansion pacing: some languages need more syllables, so speech is auto-compressed (e.g. ~1.1x) to fit the slot.',
      'Stem splitting separates dialogue from music so the original score survives the translation.',
      'Timeline alignment audits timecodes so SFX and visuals still hit on the right frame.',
      'Face-to-camera footage benefits from lip-sync translation (mouth shape), not just voice match.',
    ],
    doIt: [
      'Export the source transcript and remove filler; log timecodes (e.g. Line 1: 0:00.00–0:04.50).',
      'Configure a dubbing engine: set source and target languages, choose highest resolution to preserve music isolation.',
      'Run it — the engine splits stems, translates, re-synthesizes in the cloned voice, and recombines with the music.',
      'Audit pacing on the timeline: catch "chipmunk" over-compression and add a 0.5s freeze frame if a line clips.',
      'Verify SFX still land on their original visual frames before exporting.',
    ],
    launchIt: [
      'Use YouTube multi-language audio to stack tracks on one URL and keep view count consolidated.',
      'Always translate titles, descriptions, and tags — never ship a foreign audio track under English metadata.',
      'Sell "go global" packages to course creators and faceless channels already producing in one language.',
    ],
    exercises: [
      'Easy: translate a 3-sentence script and read both aloud; measure the spoken-time difference.',
      'Medium: submit a 10s clip to a dubbing engine and audit voice similarity.',
      'Hard: produce a dubbed clip with background SFX and confirm effects match the original frame boundaries.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '06-ai-audio-and-music::dubbing-studio-clip',
      '06-ai-audio-and-music::dubbing-studio',
    ],
  },
  {
    id: '06-ai-audio-and-music::03-podcast-production',
    slug: '06-ai-audio-and-music::03-podcast-production',
    order: 3,
    title: 'Podcast Production & Audio Cleaning',
    summary: 'Bad audio is turned off; good audio is listened to for hours.',
    time: '~35 minutes',
    prerequisites: [],
    problem:
      'Raw voice has echo, rumble, harsh sibilance, and volume swings that make listeners bail in 10 seconds. Unpolished delivery looks amateur and kills retention. You need a standard cleaning + mastering pipeline that outputs clear, consistent, platform-ready audio.',
    concept: [
      'High-pass filter: cut below ~80Hz (male) / 100Hz (female) to kill rumble and mic bumps.',
      'Noise gate: silence everything under the threshold during pauses to remove hum and breath noise.',
      'EQ: boost presence (3–5kHz) for clarity, cut mud (300–400Hz) to open the voice.',
      'Compression flattens loud/quiet swings like an automatic fader.',
      'Loudness normalization targets -16 LUFS stereo / -19 LUFS mono with a -1.0 dBTP true-peak limiter.',
      'Keep recordings dry — no reverb or EQ at capture — so you can fix everything in post.',
    ],
    doIt: [
      'Import the raw track and note its starting peak levels.',
      'Apply a high-pass filter (80–100Hz, 24dB/oct) to clear low-frequency mud.',
      'Set a noise gate (~-48dB, 10ms attack, 150ms release) so pauses go fully silent.',
      'Apply a compressor (threshold -16dB, ratio 3:1, auto makeup gain) to flatten volume.',
      'Normalize to -16.0 LUFS stereo (or -19 mono) with a -1.0 dBTP limiter; check the mix in mono.',
    ],
    launchIt: [
      'Sell podcast mastering at $50–$150 per 30-min episode — under 15 min of work, $200+/hr effective.',
      'Offer a monthly retainer (4 episodes, $300–$500) for predictable recurring income.',
      'Lead with "radio-ready in a day" to indie podcasters and YouTubers sitting on raw files.',
    ],
    exercises: [
      'Easy: apply an 80Hz high-pass to a voice recording and log the clarity change.',
      'Medium: set a noise gate until silent gaps read as complete silence.',
      'Hard: master a 1-minute intro through HPF, gate, compressor, and limiter to -16 LUFS.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '06-ai-audio-and-music::podcast-audio-console',
      '06-ai-audio-and-music::podcast-console-clip',
    ],
  },
  {
    id: '06-ai-audio-and-music::04-music-sfx-generation',
    slug: '06-ai-audio-and-music::04-music-sfx-generation',
    order: 4,
    title: 'AI Music & Sound Effects',
    summary: 'The right sound turns b-roll into a movie.',
    time: '~35 minutes',
    prerequisites: [],
    problem:
      'Stock music is expensive or gets your video muted and copyright-struck; free tracks never fit your edit. Matching tempo, mood, and drops to a script wastes hours. You need custom, copyright-free music and SFX on demand, auto-fit to the mix.',
    concept: [
      'BGM prompt matrix: specify BPM, genre, lead instruments, and always "instrumental only" so AI vocals never fight the narrator.',
      'Isolated SFX: generate whooshes, clicks, and slides with zero reverb so they drop cleanly into any scene.',
      'Auto-ducking lowers music under voice and lifts it during visual-only beats.',
      'Standard track layout: A1 voice (0dB), A2 SFX (-6dB), A3 music (-18dB).',
      'Keep music at or below -10dB or phone speakers compress the whole track and crush the voice.',
    ],
    doIt: [
      'Generate a loop from a structured prompt (e.g. "120 BPM corporate tech house, instrumental only, seamless loop") via Suno/Udio/Soundraw.',
      'Generate isolated transition SFX (whoosh, UI click) from an SFX engine.',
      'Build the three-track layout: voice, then SFX, then music.',
      'Enable auto-ducking on the music track linked to voice; duck to -18dB speaking, ~-12dB silent.',
      'Keep an SFX vault of your most-used clips to skip regenerating them per video.',
    ],
    launchIt: [
      'Bundle a "sound design pass" into every video deliverable so audio is never an afterthought.',
      'Sell a reusable SFX/music kit to other creators in your niche.',
      'Pitch B2B channels on mute-drum/keep-bass background tracks that never compete with voiceover.',
    ],
    exercises: [
      'Easy: generate a 1-minute instrumental loop tagged "loop".',
      'Medium: import voice + music and keyframe a 6dB music drop during speech.',
      'Hard: generate 3 SFX and align them to exact cut/logo-reveal frames in an edit.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '06-ai-audio-and-music::ai-music-workstation-clip',
      '06-ai-audio-and-music::ai-music-workstation',
    ],
  },
  {
    id: '06-ai-audio-and-music::05-singing-vocal-synthesis',
    slug: '06-ai-audio-and-music::05-singing-vocal-synthesis',
    order: 5,
    title: 'Singing Voice Conversion & Vocal Synthesis',
    summary: 'Synthesize the melody, clone the artist.',
    time: '~30 minutes',
    prerequisites: ['Voice Cloning & TTS Basics'],
    problem:
      'You need a theme song, musical ad, or parody intro but cannot sing, and hiring studio vocalists is costly. Plain TTS reads lyrics like a lecture — no pitch, rhythm, or timing. You need Singing Voice Conversion to turn a rough guide vocal into a polished singing voice.',
    concept: [
      'RVC (Retrieval-based Voice Conversion) projects a target singer’s timbre onto your guide vocal while keeping pitch and timing.',
      'Voice-to-voice ignores the lyrics’ text and analyzes pitch + volume envelope, then swaps the timbre.',
      'Acapella extraction: the guide must be dry and isolated, or background notes get converted into screaming artifacts.',
      'Transposition: shift male guide → female target by +12 semitones (one octave), female → male by -12.',
      'Index rate (~0.65–0.70) controls how much target character shows; consonant protection (~0.33) stops digital static.',
    ],
    doIt: [
      'Record a dry guide vocal, then pitch-correct (Auto-Tune/GSnap) to snap notes to key; save guide_vocal.wav.',
      'Load it into an RVC interface; pick the target model and set transpose (+12 / -12 semitones).',
      'Set index rate ~0.68 and consonant protection ~0.33; convert and download the .wav.',
      'Mix: add subtle plate reverb and stereo delay, limit peak to -3dB over the instrumental.',
      'Avoid famous-singer models for client work; train a custom singer model to own the IP.',
    ],
    launchIt: [
      'Sell custom theme songs and jingles to faceless channels and brands.',
      'Train and license your own singer models so the voice IP is yours.',
      'Offer "avatar theme song" add-ons to virtual-influencer and UGC clients.',
    ],
    exercises: [
      'Easy: record a 10s rhythmic, sing-song guide of yourself.',
      'Medium: convert a guide with +12 semitone shift and analyze the octave change.',
      'Hard: produce a 15s loop — extract acapella, auto-tune, RVC timbre, add delay/reverb, mix over an instrumental.',
    ],
    relatedTemplateIds: [],
    relatedAssetIds: [
      '06-ai-audio-and-music::singing-vocal-studio-clip',
      '06-ai-audio-and-music::singing-vocal-studio',
    ],
  },
];
