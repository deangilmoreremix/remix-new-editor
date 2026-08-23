// Recipes for track 09: AI Real Estate (Virtual Staging).
// Wired into the "Create With Smart Video" CTA via the template-recipes map.

export const RECIPES_09 = {
  '09-ai-real-estate-staging::virtual-staging-brief': {
    id: '09-ai-real-estate-staging::virtual-staging-brief',
    title: 'Virtual Staging Brief',
    description: 'Generate a staged real estate interior image from a property brief and interior style pack.',
    category: '09-ai-real-estate-staging',
    target: 'image',
    icon: 'Home',
    buildPrompt(ctx = {}) {
      const style = (ctx.style || 'Modern Scandinavian').toString().trim();
      return [
        `AI virtual staging image — interior design style pack: "${style}".`,
        '',
        'Property & staging brief:',
        '• Specify property type (single family, modern condo, luxury penthouse) and target buyer profile.',
        '• Preserve primary architectural features (hardwood floors, floor-to-ceiling windows, fireplaces).',
        '',
        'Interior style pack (Modern Scandinavian default):',
        '• Palette: warm white, natural oak, light beige, subtle sage green accents.',
        '• Furniture: low-profile linen sectional, light oak coffee table, neutral woven rug, potted monstera.',
        '• Lighting: diffused natural window sunlight, warm 3000K accent lamps.',
        '',
        'Recommended prompt token:',
        '"Modern Scandinavian living room virtual staging, light oak furniture, cream fabric sectional, plush beige rug, indoor potted plants, bright daylight, 8k photorealistic, architectural digest cover."',
        '',
        'Quality control checklist:',
        '• Perspective alignment: furniture edges match room vanishing point / wall angles.',
        '• Floor contact: soft AO shadows under sofa legs and tables.',
        '• Scale accuracy: furniture realistic vs doors/windows/switches.',
        '• Structural preservation: windows, doors, flooring, fireplace left unaltered.',
        '• Export JPEG ≥3000px wide, 16:9 or 4:3 for MLS.',
      ].join('\n');
    },
  },

  '09-ai-real-estate-staging::agency-outreach-template': {
    id: '09-ai-real-estate-staging::agency-outreach-template',
    title: 'Agency Outreach Video',
    description: 'Generate a 60-second virtual-staging cold-pitch commercial for real estate agents.',
    category: '09-ai-real-estate-staging',
    target: 'commercial',
    icon: 'Megaphone',
    buildPrompt(ctx = {}) {
      const city = (ctx.city || '[City Name]').toString().trim();
      return [
        `60-second virtual staging agency outreach commercial — market: ${city}.`,
        '',
        'Hook (0-5s): "Hey [Agent Name], [Your Name] here. I was browsing active listings in ${city} and came across your property."',
        'Problem (5-15s): show a vacant living room photo — buyers struggle to visualize empty spaces.',
        'Demo (15-40s): cut a before/after transformation — modern sectional + warm rug anchor the room into a luxury home; stage the entire listing in 24 hours for $199.',
        'CTA (40-60s): "I\'ll drop a link to the high-res samples — want the final files for your MLS update today?"',
        '',
        'Style: confident, friendly, screen-recorded Loom-style walkthrough, burned-in captions, branded lower-third with studio name + phone. Highlight ROI vs physical staging (save thousands) and a 35% photographer commission split option.',
      ].join('\n');
    },
  },
};
