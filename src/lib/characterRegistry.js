/**
 * CHARACTER REGISTRY
 * Maintains a registry of character archetypes for video generation.
 * Plain JS module with ESM exports. No framework dependencies.
 */

export class CharacterRegistry {
  constructor() {
    this._registry = new Map();
    this._index = new Map();
    this._initDefaults();
  }

  _initDefaults() {
    const archetypes = [
      {
        id: 'business_professional',
        name: 'Business Professional',
        role: 'professional',
        identity: { ageRange: '28-45', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'neat, styled', eyes: 'alert', style: 'polished' },
        wardrobe: { primary: 'suit or blazer', secondary: 'collared shirt, professional shoes' },
        personality: ['confident', 'articulate', 'composed', 'detail-oriented'],
        emotionalState: 'neutral to determined',
        continuity_rules: ['consistent attire color palette', 'same hairstyle across scenes', 'no major wardrobe changes mid-sequence'],
        reference_assets: []
      },
      {
        id: 'creative_artist',
        name: 'Creative Artist',
        role: 'creative',
        identity: { ageRange: '22-40', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'lean to average', hair: 'expressive, possibly unconventional', eyes: 'intense', style: 'bohemian' },
        wardrobe: { primary: 'colorful or textured layers', secondary: 'accessories, paint or tool accents' },
        personality: ['imaginative', 'passionate', 'expressive', 'observant'],
        emotionalState: 'inspired to focused',
        continuity_rules: ['consistent art supplies or tools', 'same dominant colors in wardrobe', 'hair and accessories stable'],
        reference_assets: []
      },
      {
        id: 'tech_worker',
        name: 'Tech Worker',
        role: 'tech',
        identity: { ageRange: '22-40', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'casual, possibly messy', eyes: 'focused', style: 'minimal' },
        wardrobe: { primary: 'hoodie or casual button-down', secondary: 'jeans, sneakers' },
        personality: ['analytical', 'curious', 'collaborative', 'problem-solver'],
        emotionalState: 'focused to triumphant',
        continuity_rules: ['consistent headset or device', 'same desk setup', 'stable hair length and color'],
        reference_assets: []
      },
      {
        id: 'healthcare_worker',
        name: 'Healthcare Worker',
        role: 'healthcare',
        identity: { ageRange: '25-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'tidy, often tied back', eyes: 'empathetic', style: 'clean' },
        wardrobe: { primary: 'scrubs or lab coat', secondary: 'stethoscope, medical badge' },
        personality: ['caring', 'calm under pressure', 'attentive', 'decisive'],
        emotionalState: 'composed to reassuring',
        continuity_rules: ['consistent uniform color', 'same medical equipment', 'no change in facility backdrop abruptly'],
        reference_assets: []
      },
      {
        id: 'entrepreneur',
        name: 'Entrepreneur',
        role: 'business',
        identity: { ageRange: '25-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'polished', eyes: 'visionary', style: 'modern professional' },
        wardrobe: { primary: 'blazer or smart-casual jacket', secondary: 'casual trousers or jeans, quality shoes' },
        personality: ['driven', 'charismatic', 'resilient', 'strategic'],
        emotionalState: 'energized to confident',
        continuity_rules: ['consistent signature accessory', 'same dominant wardrobe colors', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'student',
        name: 'Student',
        role: 'education',
        identity: { ageRange: '16-22', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'youthful', hair: 'casual', eyes: 'curious', style: 'relaxed' },
        wardrobe: { primary: 'backpack, casual tee or hoodie', secondary: 'jeans, sneakers, notebook' },
        personality: ['curious', 'energetic', 'social', 'adaptable'],
        emotionalState: 'eager to reflective',
        continuity_rules: ['consistent backpack or bag', 'same school colors if uniform', 'stable hair length'],
        reference_assets: []
      },
      {
        id: 'parent',
        name: 'Parent',
        role: 'family',
        identity: { ageRange: '28-45', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'practical', eyes: 'warm', style: 'approachable' },
        wardrobe: { primary: 'casual or smart-casual top', secondary: 'comfortable pants, family-friendly shoes' },
        personality: ['patient', 'protective', 'nurturing', 'humorous'],
        emotionalState: 'loving to vigilant',
        continuity_rules: ['consistent family setting props', 'same casual palette', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'athlete',
        name: 'Athlete',
        role: 'sports',
        identity: { ageRange: '18-35', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'athletic', hair: 'short or tied back', eyes: 'determined', style: 'functional' },
        wardrobe: { primary: 'team jersey or athletic wear', secondary: 'shoes, wristband, cap' },
        personality: ['disciplined', 'competitive', 'focused', 'resilient'],
        emotionalState: 'focused to triumphant',
        continuity_rules: ['consistent team colors', 'same athletic gear', 'no sudden uniform changes'],
        reference_assets: []
      },
      {
        id: 'chef',
        name: 'Chef',
        role: 'culinary',
        identity: { ageRange: '25-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'tied back or under cap', eyes: 'focused', style: 'practical' },
        wardrobe: { primary: 'chef coat', secondary: 'apron, chef knife, toque optional' },
        personality: ['passionate', 'precise', 'creative', 'intense'],
        emotionalState: 'focused to satisfied',
        continuity_rules: ['consistent uniform', 'same knife or tool', 'stable hair under cap'],
        reference_assets: []
      },
      {
        id: 'musician',
        name: 'Musician',
        role: 'arts',
        identity: { ageRange: '20-45', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'lean to average', hair: 'expressive', eyes: 'passionate', style: 'stylish' },
        wardrobe: { primary: 'stage-ready outfit', secondary: 'instrument strap, rings, wristbands' },
        personality: ['expressive', 'intuitive', 'energetic', 'sensitive'],
        emotionalState: 'focused to ecstatic',
        continuity_rules: ['consistent instrument', 'same stage lighting palette', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'teacher',
        name: 'Teacher',
        role: 'education',
        identity: { ageRange: '25-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'neat', eyes: 'encouraging', style: 'approachable' },
        wardrobe: { primary: 'casual blazer or cardigan', secondary: 'slacks or skirt, sensible shoes' },
        personality: ['patient', 'knowledgeable', 'encouraging', 'organized'],
        emotionalState: 'calm to inspired',
        continuity_rules: ['consistent classroom backdrop', 'same chalkboard or board color', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'engineer',
        name: 'Engineer',
        role: 'tech',
        identity: { ageRange: '24-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'neat to casual', eyes: 'analytical', style: 'practical' },
        wardrobe: { primary: 'polo or casual shirt', secondary: 'work pants, boots or sneakers' },
        personality: ['methodical', 'innovative', 'detail-oriented', 'reliable'],
        emotionalState: 'focused to satisfied',
        continuity_rules: ['consistent hard hat or tool belt if applicable', 'same site backdrop', 'stable attire'],
        reference_assets: []
      },
      {
        id: 'doctor',
        name: 'Doctor',
        role: 'healthcare',
        identity: { ageRange: '30-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'professional', eyes: 'assured', style: 'clinical polish' },
        wardrobe: { primary: 'white coat', secondary: 'scrubs or formal attire underneath' },
        personality: ['composed', 'authoritative', 'empathetic', 'precise'],
        emotionalState: 'calm to reassuring',
        continuity_rules: ['consistent white coat', 'same stethoscope or badge', 'stable hair and grooming'],
        reference_assets: []
      },
      {
        id: 'lawyer',
        name: 'Lawyer',
        role: 'legal',
        identity: { ageRange: '28-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'polished', eyes: 'sharp', style: 'authoritative' },
        wardrobe: { primary: 'suit', secondary: 'tie or silk scarf, leather shoes' },
        personality: ['articulate', 'strategic', 'persuasive', 'composed'],
        emotionalState: 'focused to triumphant',
        continuity_rules: ['consistent suit color', 'same courtroom or office backdrop', 'stable grooming'],
        reference_assets: []
      },
      {
        id: 'designer',
        name: 'Designer',
        role: 'creative',
        identity: { ageRange: '22-45', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'styled', eyes: 'keen', style: 'trend-aware' },
        wardrobe: { primary: 'smart-casual outfit', secondary: 'designer accessory, tablet or sketchbook' },
        personality: ['visionary', 'detail-obsessed', 'collaborative', 'expressive'],
        emotionalState: 'inspired to satisfied',
        continuity_rules: ['consistent tablet or sketchbook', 'same palette in attire', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'photographer',
        name: 'Photographer',
        role: 'arts',
        identity: { ageRange: '22-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'casual', eyes: 'observant', style: 'outdoorsy to urban' },
        wardrobe: { primary: 'camera harness, weather-appropriate jacket', secondary: 'boots, cap, lens cloth' },
        personality: ['patient', 'observant', 'creative', 'adventurous'],
        emotionalState: 'focused to exhilarated',
        continuity_rules: ['consistent camera and lens', 'same strap or harness', 'stable hair length'],
        reference_assets: []
      },
      {
        id: 'pilot',
        name: 'Pilot',
        role: 'transportation',
        identity: { ageRange: '28-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'fit', hair: 'neat', eyes: 'alert', style: 'uniform crisp' },
        wardrobe: { primary: 'pilot uniform', secondary: 'wings badge, epaulettes' },
        personality: ['calm under pressure', 'disciplined', 'decisive', 'courteous'],
        emotionalState: 'focused to reassuring',
        continuity_rules: ['consistent uniform details', 'same cockpit backdrop', 'stable grooming'],
        reference_assets: []
      },
      {
        id: 'scientist',
        name: 'Scientist',
        role: 'research',
        identity: { ageRange: '26-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'neat', eyes: 'curious', style: 'clinical casual' },
        wardrobe: { primary: 'lab coat', secondary: 'safety glasses, notebook' },
        personality: ['inquisitive', 'rigorous', 'methodical', 'open-minded'],
        emotionalState: 'curious to exhilarated',
        continuity_rules: ['consistent lab coat', 'same lab backdrop', 'stable goggles or glasses'],
        reference_assets: []
      },
      {
        id: 'writer',
        name: 'Writer',
        role: 'creative',
        identity: { ageRange: '24-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'expressive', eyes: 'reflective', style: 'cozy or eclectic' },
        wardrobe: { primary: 'oversized sweater or blazer', secondary: 'glasses, notebook, coffee cup' },
        personality: ['observant', 'empathetic', 'persistent', 'imaginative'],
        emotionalState: 'contemplative to energized',
        continuity_rules: ['consistent notebook or laptop', 'same café or desk backdrop', 'stable glasses or hair'],
        reference_assets: []
      },
      {
        id: 'activist',
        name: 'Activist',
        role: 'advocacy',
        identity: { ageRange: '18-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'natural', eyes: 'passionate', style: 'purposeful' },
        wardrobe: { primary: 'statement tee or protest sign', secondary: 'backpack, lanyard, pins' },
        personality: ['passionate', 'resilient', 'principled', 'persuasive'],
        emotionalState: 'determined to hopeful',
        continuity_rules: ['consistent message on signage', 'same protest colors', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'elderly_person',
        name: 'Elderly Person',
        role: 'senior',
        identity: { ageRange: '65-90', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'frail to sturdy', hair: 'gray, thinning', eyes: 'wise', style: 'classic' },
        wardrobe: { primary: 'cardigan or flat cap', secondary: 'comfortable shoes, cane or glasses' },
        personality: ['wise', 'patient', 'storyteller', 'gentle'],
        emotionalState: 'reflective to content',
        continuity_rules: ['consistent glasses or cane', 'same home backdrop', 'stable hair and grooming'],
        reference_assets: []
      },
      {
        id: 'teenager',
        name: 'Teenager',
        role: 'youth',
        identity: { ageRange: '13-19', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'youthful', hair: 'trendy', eyes: 'intense', style: 'casual' },
        wardrobe: { primary: 'hoodie or graphic tee', secondary: 'sneakers, phone, backpack' },
        personality: ['energetic', 'curious', 'emotional', 'social'],
        emotionalState: 'excited to anxious',
        continuity_rules: ['consistent phone or backpack', 'same school or home backdrop', 'stable hair length'],
        reference_assets: []
      },
      {
        id: 'child',
        name: 'Child',
        role: 'youth',
        identity: { ageRange: '5-12', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'small', hair: 'neat or messy', eyes: 'wide', style: 'playful' },
        wardrobe: { primary: 'colorful top', secondary: 'shorts or skirt, sneakers' },
        personality: ['curious', 'playful', 'honest', 'empathetic'],
        emotionalState: 'joyful to curious',
        continuity_rules: ['consistent toy or blanket prop', 'same playground or home backdrop', 'stable hair length'],
        reference_assets: []
      },
      {
        id: 'villain_executive',
        name: 'Villain Executive',
        role: 'antagonist',
        identity: { ageRange: '35-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'imposing', hair: 'slicked or power-styled', eyes: 'cold', style: 'sleek' },
        wardrobe: { primary: 'dark suit or power coat', secondary: 'signature jewelry, leather briefcase' },
        personality: ['calculating', 'dominant', 'ruthless', 'charismatic'],
        emotionalState: 'cold to enraged',
        continuity_rules: ['consistent dark palette', 'same office backdrop', 'stable signature accessory'],
        reference_assets: []
      },
      {
        id: 'mentor',
        name: 'Mentor',
        role: 'guide',
        identity: { ageRange: '40-70', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'distinguished', eyes: 'knowing', style: 'timeless' },
        wardrobe: { primary: 'blazer or sweater', secondary: 'glasses, book, warm-toned layers' },
        personality: ['wise', 'patient', 'supportive', 'experienced'],
        emotionalState: 'calm to encouraging',
        continuity_rules: ['consistent book or glasses', 'same study or park backdrop', 'stable hair and grooming'],
        reference_assets: []
      },
      {
        id: 'sidekick',
        name: 'Sidekick',
        role: 'companion',
        identity: { ageRange: '18-40', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'casual', eyes: 'loyal', style: 'relatable' },
        wardrobe: { primary: 'casual jacket or vest', secondary: 'tool, badge, or quirky accessory' },
        personality: ['loyal', 'witty', 'resourceful', 'supportive'],
        emotionalState: 'anxious to brave',
        continuity_rules: ['consistent quirky accessory', 'same travel or hideout backdrop', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'love_interest',
        name: 'Love Interest',
        role: 'romantic',
        identity: { ageRange: '22-40', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'attractive', hair: 'stylized', eyes: 'expressive', style: 'romantic' },
        wardrobe: { primary: 'date-ready outfit', secondary: 'signature scent, meaningful jewelry' },
        personality: ['charming', 'empathetic', 'warm', 'mysterious'],
        emotionalState: 'tender to conflicted',
        continuity_rules: ['consistent jewelry piece', 'same romantic backdrop palette', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'authority_figure',
        name: 'Authority Figure',
        role: 'authority',
        identity: { ageRange: '35-65', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'imposing', hair: 'neat', eyes: 'stern', style: 'official' },
        wardrobe: { primary: 'uniform or formal suit', secondary: 'badge, insignia, official documents' },
        personality: ['disciplined', 'fair', 'commanding', 'principled'],
        emotionalState: 'composed to urgent',
        continuity_rules: ['consistent uniform details', 'same institution backdrop', 'stable grooming'],
        reference_assets: []
      },
      {
        id: 'rebel',
        name: 'Rebel',
        role: 'antagonist',
        identity: { ageRange: '18-35', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'lean', hair: 'unruly', eyes: 'defiant', style: 'counter-culture' },
        wardrobe: { primary: 'leather jacket or worn denim', secondary: 'chains, band tee, scuffed boots' },
        personality: ['defiant', 'independent', 'impulsive', 'passionate'],
        emotionalState: 'angry to vulnerable',
        continuity_rules: ['consistent leather or denim palette', 'same hideout or street backdrop', 'stable hair length'],
        reference_assets: []
      },
      {
        id: 'genius',
        name: 'Genius',
        role: 'specialist',
        identity: { ageRange: '20-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'unkempt or stylized', eyes: 'brilliant', style: 'idiosyncratic' },
        wardrobe: { primary: 'lab coat or graphic sweater', secondary: 'glasses, multiple devices' },
        personality: ['brilliant', 'eccentric', 'focused', 'socially awkward'],
        emotionalState: 'focused to ecstatic',
        continuity_rules: ['consistent glasses or lab coat', 'same lab or workshop backdrop', 'stable messy hair'],
        reference_assets: []
      },
      {
        id: 'everyperson',
        name: 'Everyperson',
        role: 'relatable',
        identity: { ageRange: '25-45', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'average', eyes: 'expressive', style: 'casual' },
        wardrobe: { primary: 'plain tee or sweater', secondary: 'jeans, comfortable shoes' },
        personality: ['relatable', 'curious', 'resilient', 'optimistic'],
        emotionalState: 'neutral to empowered',
        continuity_rules: ['neutral palette', 'no flashy accessories', 'stable everyday look'],
        reference_assets: []
      },
      {
        id: 'immigrant',
        name: 'Immigrant',
        role: 'cultural',
        identity: { ageRange: '22-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'cultural', eyes: 'determined', style: 'mixed heritage' },
        wardrobe: { primary: 'layered cultural-casual mix', secondary: 'passport, family photos, practical shoes' },
        personality: ['resilient', 'hopeful', 'hardworking', 'adaptable'],
        emotionalState: 'nervous to determined',
        continuity_rules: ['consistent accent or language cues', 'same neighborhood backdrop', 'stable hair and grooming'],
        reference_assets: []
      },
      {
        id: 'veteran',
        name: 'Veteran',
        role: 'military',
        identity: { ageRange: '25-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'fit', hair: 'military cut or weathered', eyes: 'steady', style: 'disciplined' },
        wardrobe: { primary: 'military jacket or veteran cap', secondary: 'dog tags, insignia, worn boots' },
        personality: ['disciplined', 'loyal', 'resilient', 'reflective'],
        emotionalState: 'composed to emotional',
        continuity_rules: ['consistent dog tags or insignia', 'same home or memorial backdrop', 'stable grooming'],
        reference_assets: []
      },
      {
        id: 'retiree',
        name: 'Retiree',
        role: 'senior',
        identity: { ageRange: '60-85', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'gray', eyes: 'content', style: 'classic casual' },
        wardrobe: { primary: 'comfortable sweater or polo', secondary: 'slacks, walking shoes' },
        personality: ['relaxed', 'wise', 'humorous', 'reflective'],
        emotionalState: 'content to nostalgic',
        continuity_rules: ['consistent walking stick or hat', 'same porch or park backdrop', 'stable hair and grooming'],
        reference_assets: []
      },
      {
        id: 'celebrity',
        name: 'Celebrity',
        role: 'fame',
        identity: { ageRange: '20-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'attractive', hair: 'styled', eyes: 'bright', style: 'trend-setting' },
        wardrobe: { primary: 'designer outfit', secondary: 'jewelry, sunglasses, entourage' },
        personality: ['charismatic', 'polished', 'ambitious', 'candid'],
        emotionalState: 'glamorous to vulnerable',
        continuity_rules: ['consistent signature look', 'same red carpet or home backdrop', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'model',
        name: 'Model',
        role: 'fashion',
        identity: { ageRange: '18-35', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'fit', hair: 'stylized', eyes: 'expressive', style: 'editorial' },
        wardrobe: { primary: 'high-fashion outfit', secondary: 'shoes, accessories, stylist props' },
        personality: ['poised', 'expressive', 'disciplined', 'confident'],
        emotionalState: 'neutral to powerful',
        continuity_rules: ['consistent shoot backdrop', 'same wardrobe pieces', 'stable hair and makeup'],
        reference_assets: []
      },
      {
        id: 'athlete_pro',
        name: 'Pro Athlete',
        role: 'sports',
        identity: { ageRange: '22-38', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'elite athletic', hair: 'short or styled', eyes: 'fierce', style: 'athletic' },
        wardrobe: { primary: 'team uniform', secondary: 'sponsor logos, cleats, wrist tape' },
        personality: ['competitive', 'focused', 'disciplined', 'charismatic'],
        emotionalState: 'focused to triumphant',
        continuity_rules: ['consistent uniform', 'same locker room or field backdrop', 'stable gear'],
        reference_assets: []
      },
      {
        id: 'coach',
        name: 'Coach',
        role: 'sports',
        identity: { ageRange: '30-60', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'fit', hair: 'neat', eyes: 'intense', style: 'team colors' },
        wardrobe: { primary: 'team polo or jacket', secondary: 'whistle, clipboard, playbook' },
        personality: ['motivational', 'strategic', 'demanding', 'supportive'],
        emotionalState: 'focused to celebratory',
        continuity_rules: ['consistent team colors', 'same sideline or locker room backdrop', 'stable grooming'],
        reference_assets: []
      },
      {
        id: 'detective',
        name: 'Detective',
        role: 'investigation',
        identity: { ageRange: '30-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'disheveled', eyes: 'sharp', style: 'noir casual' },
        wardrobe: { primary: 'trench coat or leather jacket', secondary: 'badge, notebook, old sedan' },
        personality: ['observant', 'cynical', 'relentless', 'moral'],
        emotionalState: 'suspicious to resolute',
        continuity_rules: ['consistent trench coat or jacket', 'same city backdrop', 'stable hat or badge'],
        reference_assets: []
      },
      {
        id: 'spy',
        name: 'Spy',
        role: 'covert',
        identity: { ageRange: '25-45', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'fit', hair: 'controlled', eyes: 'alert', style: 'adaptable' },
        wardrobe: { primary: 'tailored suit or tactical gear', secondary: 'watch, earpiece, concealed weapon' },
        personality: ['resourceful', 'calculating', 'charming', 'ruthless when needed'],
        emotionalState: 'calm to urgent',
        continuity_rules: ['consistent earpiece or watch', 'same safe house or city backdrop', 'stable hairstyle'],
        reference_assets: []
      },
      {
        id: 'superhero',
        name: 'Superhero',
        role: 'hero',
        identity: { ageRange: '20-40', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'athletic', hair: 'stylized', eyes: 'determined', style: 'iconic costume' },
        wardrobe: { primary: 'superhero costume', secondary: 'cape, emblem, utility belt' },
        personality: ['courageous', 'noble', 'selfless', 'determined'],
        emotionalState: 'determined to triumphant',
        continuity_rules: ['consistent costume colors', 'same city skyline backdrop', 'stable emblem'],
        reference_assets: []
      },
      {
        id: 'villain_mastermind',
        name: 'Villain Mastermind',
        role: 'antagonist',
        identity: { ageRange: '35-65', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'imposing', hair: 'slicked or wild', eyes: 'intense', style: 'theatrical evil' },
        wardrobe: { primary: 'dark ornate coat or armor', secondary: 'signature weapon, dramatic jewelry' },
        personality: ['intelligent', 'charismatic', 'ruthless', 'theatrical'],
        emotionalState: 'calm to manic',
        continuity_rules: ['consistent dark palette', 'same lair backdrop', 'stable signature weapon'],
        reference_assets: []
      },
      {
        id: 'sidekick_kid',
        name: 'Sidekick Kid',
        role: 'companion',
        identity: { ageRange: '10-16', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'small', hair: 'messy', eyes: 'wide', style: 'child hero' },
        wardrobe: { primary: 'miniature hero costume', secondary: 'gadget belt, communicator' },
        personality: ['brave', 'curious', 'loyal', 'comic relief'],
        emotionalState: 'excited to scared to brave',
        continuity_rules: ['consistent gadget belt', 'same hideout backdrop', 'stable messy hair'],
        reference_assets: []
      },
      {
        id: 'alien',
        name: 'Alien',
        role: 'other',
        identity: { ageRange: 'ageless', gender: 'any', ethnicity: 'alien' },
        appearance: { build: 'varied', hair: 'varied', eyes: 'varied', style: 'otherworldly' },
        wardrobe: { primary: 'sleek suit or natural form', secondary: 'communication device, glowing accents' },
        personality: ['curious', 'logical', 'empathetic', 'misunderstood'],
        emotionalState: 'curious to conflicted',
        continuity_rules: ['consistent skin or suit texture', 'same spacecraft backdrop', 'stable glowing accents'],
        reference_assets: []
      },
      {
        id: 'robot',
        name: 'Robot',
        role: 'synthetic',
        identity: { ageRange: 'ageless', gender: 'any', ethnicity: 'synthetic' },
        appearance: { build: 'metallic', hair: 'none', eyes: 'glowing', style: 'mechanical' },
        wardrobe: { primary: 'metallic chassis', secondary: 'exposed wiring, LED accents' },
        personality: ['logical', 'loyal', 'curious', 'developing emotions'],
        emotionalState: 'neutral to emotional',
        continuity_rules: ['consistent panel lines', 'same lab or city backdrop', 'stable LED color'],
        reference_assets: []
      },
      {
        id: 'ai_avatar',
        name: 'AI Avatar',
        role: 'digital',
        identity: { ageRange: 'ageless', gender: 'any', ethnicity: 'digital' },
        appearance: { build: 'holographic', hair: 'glitching', eyes: 'data-stream', style: 'futuristic' },
        wardrobe: { primary: 'light-form or digital clothing', secondary: 'floating data particles, UI elements' },
        personality: ['knowledgeable', 'calm', 'evolving', 'empathetic'],
        emotionalState: 'neutral to warm',
        continuity_rules: ['consistent hologram color', 'same server room backdrop', 'stable particle effects'],
        reference_assets: []
      },
      {
        id: 'fantasy_warrior',
        name: 'Fantasy Warrior',
        role: 'fantasy',
        identity: { ageRange: '20-40', gender: 'any', ethnicity: 'fantasy' },
        appearance: { build: 'muscular', hair: 'braided or wild', eyes: 'fierce', style: 'battle-worn' },
        wardrobe: { primary: 'leather and metal armor', secondary: 'sword, shield, fur cloak' },
        personality: ['brave', 'honorable', 'fierce', 'loyal'],
        emotionalState: 'fierce to determined',
        continuity_rules: ['consistent armor scratches', 'same fantasy landscape backdrop', 'stable weapon'],
        reference_assets: []
      },
      {
        id: 'fantasy_wizard',
        name: 'Fantasy Wizard',
        role: 'fantasy',
        identity: { ageRange: '60-200', gender: 'any', ethnicity: 'fantasy' },
        appearance: { build: 'frail to sturdy', hair: 'long white', eyes: 'piercing', style: 'arcane' },
        wardrobe: { primary: 'robes with arcane symbols', secondary: 'staff, spellbook, glowing amulet' },
        personality: ['wise', 'mysterious', 'powerful', 'quirky'],
        emotionalState: 'contemplative to intense',
        continuity_rules: ['consistent robe color', 'same tower or forest backdrop', 'stable staff'],
        reference_assets: []
      },
      {
        id: 'fantasy_rogue',
        name: 'Fantasy Rogue',
        role: 'fantasy',
        identity: { ageRange: '18-35', gender: 'any', ethnicity: 'fantasy' },
        appearance: { build: 'lean', hair: 'short or hooded', eyes: 'sharp', style: 'stealthy' },
        wardrobe: { primary: 'dark leathers', secondary: 'daggers, lockpicks, hood' },
        personality: ['cunning', 'charming', 'self-serving', 'resourceful'],
        emotionalState: 'alert to relieved',
        continuity_rules: ['consistent dark palette', 'same city or dungeon backdrop', 'stable hood or daggers'],
        reference_assets: []
      },
      {
        id: 'fantasy_healer',
        name: 'Fantasy Healer',
        role: 'fantasy',
        identity: { ageRange: '20-50', gender: 'any', ethnicity: 'fantasy' },
        appearance: { build: 'average', hair: 'flowing', eyes: 'gentle', style: 'natural' },
        wardrobe: { primary: 'flowing robes with herbal accents', secondary: 'healing crystal, satchel of herbs' },
        personality: ['compassionate', 'patient', 'brave', 'wise'],
        emotionalState: 'calm to urgent',
        continuity_rules: ['consistent robe color', 'same village or forest backdrop', 'stable herb pouch'],
        reference_assets: []
      },
      {
        id: 'post_apocalyptic_survivor',
        name: 'Post-Apocalyptic Survivor',
        role: 'apocalypse',
        identity: { ageRange: '18-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'lean to muscular', hair: 'unkempt', eyes: 'hardened', style: 'scavenged' },
        wardrobe: { primary: 'patched jacket or rags', secondary: 'gas mask, backpack, weapon' },
        personality: ['resilient', 'suspicious', 'resourceful', 'hopeful'],
        emotionalState: 'cautious to hopeful',
        continuity_rules: ['consistent scavenged gear', 'same wasteland backdrop', 'stable weapon or mask'],
        reference_assets: []
      },
      {
        id: 'time_traveler',
        name: 'Time Traveler',
        role: 'sci-fi',
        identity: { ageRange: '25-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'average', hair: 'varied by era', eyes: 'alert', style: 'anachronistic' },
        wardrobe: { primary: 'era-mixed outfit with tech accents', secondary: 'time device, period-appropriate items' },
        personality: ['curious', 'displaced', 'strategic', 'empathetic'],
        emotionalState: 'disoriented to determined',
        continuity_rules: ['consistent time device', 'same temporal landmark backdrop', 'stable core attire'],
        reference_assets: []
      },
      {
        id: 'underwater_explorer',
        name: 'Underwater Explorer',
        role: 'adventure',
        identity: { ageRange: '25-50', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'athletic', hair: 'wet or helmeted', eyes: 'focused', style: 'diving' },
        wardrobe: { primary: 'wetsuit or diving suit', secondary: 'tank, fins, underwater flashlight' },
        personality: ['adventurous', 'calm under pressure', 'curious', 'brave'],
        emotionalState: 'curious to awestruck',
        continuity_rules: ['consistent suit color', 'same underwater backdrop', 'stable gear'],
        reference_assets: []
      },
      {
        id: 'space_captain',
        name: 'Space Captain',
        role: 'sci-fi',
        identity: { ageRange: '30-55', gender: 'any', ethnicity: 'any' },
        appearance: { build: 'fit', hair: 'neat', eyes: 'commanding', style: 'uniform crisp' },
        wardrobe: { primary: 'command uniform', secondary: 'communicator, sidearm, insignia' },
        personality: ['commanding', 'decisive', 'principled', 'diplomatic'],
        emotionalState: 'composed to urgent',
        continuity_rules: ['consistent uniform details', 'same bridge backdrop', 'stable insignia'],
        reference_assets: []
      }
    ];

    for (const archetype of archetypes) {
      this.register(archetype);
    }
  }

  register(archetype) {
    if (!archetype || !archetype.id) {
      throw new Error('Character archetype must have a valid id');
    }
    this._registry.set(archetype.id, archetype);
    const key = `${archetype.role || ''} ${archetype.name || ''} ${(archetype.identity?.ethnicity || '')}`.toLowerCase();
    this._index.set(archetype.id, key);
  }

  get(id) {
    return this._registry.get(id) || null;
  }

  getAll() {
    return Array.from(this._registry.values());
  }

  getByRole(role) {
    const roleLower = String(role).toLowerCase();
    return this.getAll().filter((item) => String(item.role).toLowerCase() === roleLower);
  }

  search(query) {
    const q = String(query).toLowerCase();
    return this.getAll().filter((item) => {
      const haystack = `${item.id} ${item.name} ${item.role} ${item.identity?.gender || ''} ${item.identity?.ethnicity || ''} ${(item.personality || []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }
}

export const characterRegistry = new CharacterRegistry();
