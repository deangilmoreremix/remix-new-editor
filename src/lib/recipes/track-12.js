export const RECIPES_12 = {
  '12-ai-stock-content-and-licensing::commercial-stock-prompt-library': {
    id: '12-ai-stock-content-and-licensing::commercial-stock-prompt-library',
    title: 'Commercial Stock Prompt Library',
    description: 'Generate high-demand commercial stock imagery across top-selling stock categories.',
    category: '12-ai-stock-content-and-licensing',
    target: 'image',
    icon: 'Image',
    buildPrompt(ctx = {}) {
      const subject = (ctx.subject || 'business executives shaking hands').toString().trim();
      return [
        'Generate a licensable, commercial-grade stock image. Structure every prompt with:',
        'photorealistic 8k, commercial stock photo, subject, environment/lighting, copy space for text overlay, lens + depth of field.',
        '',
        `Subject this run: ${subject}`,
        '',
        'Top-selling category cheat-sheet:',
        '1. Business/Corporate/Remote Work — executive handshake, remote video call, team presentation.',
        '2. Cyber Security/High-Tech — glowing server room, biometric scan, AI cloud network over city skyline.',
        '3. Green Energy — solar farm at sunrise, wind turbines on coastal hill at golden hour.',
        '4. Healthcare/Biotech — doctor-patient trust, scientist in biotech lab.',
        '5. Fintech/Mobile Payments — contactless phone payment, financial growth charts on glass display.',
        '',
        'Style rules: photorealistic 8k, copy space, natural/optimistic lighting, 35mm lens, high resolution, no brand logos, no registered landmarks, no text artifacts.',
        'Deliver 3–5 batch variants per category for a licensable catalog.',
      ].join('\n');
    },
  },

  '12-ai-stock-content-and-licensing::stock-metadata-template': {
    id: '12-ai-stock-content-and-licensing::stock-metadata-template',
    title: 'Stock Metadata & Tagging Template',
    description: 'Build IPTC keywording and batch CSV metadata for stock submission.',
    category: '12-ai-stock-content-and-licensing',
    target: 'image',
    icon: 'Tags',
    buildPrompt(ctx = {}) {
      const asset = (ctx.asset || 'diverse business executives shaking hands').toString().trim();
      return [
        `Produce submission-ready stock metadata for the asset: ${asset}.`,
        '',
        'IPTC Keywording Framework (30–40 keywords, relevance weighted):',
        'Tier 1 — Primary Subject (5-8): handshake, business meeting, corporate executive, partnership, deal, contract.',
        'Tier 2 — Environment & Lighting (8-12): modern office, sunlit, glass window, conference table, depth of field, 8k.',
        'Tier 3 — Abstract Concepts (10-15): trust, agreement, teamwork, success, finance, leadership, negotiation, copy space.',
        '',
        'Batch CSV schema: Filename,Title,Keywords,Category (semicolon-separated keywords).',
        'Example Title: "Diverse Business Executives Shaking Hands in Modern Office" (Category: Business).',
        '',
        'Rejection Prevention Checklist:',
        '• No Brand Logos (Apple, Nike, Microsoft, car emblems).',
        '• No Registered Landmarks (Eiffel Tower night, Sydney Opera House closeups).',
        '• AI Tag Checked — enable "Generative AI" on contributor portal.',
        '• No Artifacts at 100% crop — inspect hands, eyes, and text detail.',
      ].join('\n');
    },
  },
};
