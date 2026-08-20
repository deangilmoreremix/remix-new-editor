// Smart Video AI Monetization - Business templates for pricing, outreach, and contracts.

export const BUSINESS_TEMPLATES = [
  { id: 'pricing-sheet', title: 'Smart Video AI Pricing Sheet', type: 'pricing', body: 'Smart Video AI Services | Basic | Pro | Enterprise\nAI Short-Form Video | $150 | $350 | $900\nProduct Commercial | $250 | $600 | $1,500\nSocial Package | $400 | $800 | $2,000' },
  { id: 'outreach-email', title: 'Smart Video AI Outreach Email', type: 'outreach', body: 'Subject: AI video for {{business}}\n\nHi {{name}},\n\nI create short-form AI video for {{niche}}. Can we talk about how this could help {{business}}?\n\nBest,\n{{your_name}}' },
  { id: 'contract-basic', title: 'Smart Video AI Basic Contract', type: 'contract', body: 'Scope: {{scope}}\nDeliverables: {{deliverables}}\nRevisions: 2 rounds\nTimeline: {{timeline}}\nRate: {{rate}}\nDeposit: 50% upfront' },
  { id: 'invoice-template', title: 'Smart Video AI Invoice Template', type: 'invoice', body: 'Bill To: {{client}}\nProject: {{project}}\nRate: {{rate}}\nTotal Due: {{total}}\nDue Date: {{date}}' },
  { id: 'script-template', title: 'Smart Video AI Video Script', type: 'script', body: 'Hook (0-3s): {{hook}}\nProblem (3-10s): {{problem}}\nSolution (10-25s): {{solution}}\nCTA (25-30s): {{cta}}' }
];

export function getTemplateById(id) {
  return BUSINESS_TEMPLATES.find(t => t.id === id) || null;
}

export function searchTemplates({ query = '', type = '' } = {}) {
  const q = query.toLowerCase().trim();
  return BUSINESS_TEMPLATES.filter(t => {
    if (type && t.type !== type) return false;
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
  });
}
