/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-pool-long",
  "name": "Pool leak detection: full landing page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-pool-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19e8ff",
    "highlight": "#19e8ff",
    "bg": "#06142a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-pool-long",
        "accent": "#19e8ff",
        "background": "#06142a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-pool-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-pool-long/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Features",
              "url": ""
            },
            {
              "label": "Results",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            },
            {
              "label": "For Pool Pros",
              "url": ""
            },
            {
              "label": "Resources",
              "url": ""
            }
          ],
          "loginLabel": "Book a Demo",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-pool-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Here's a\nSmarter Way to Find and Fix\n[[Your Pool Leak Fast]]",
          "subhead": "I created a quick, personalized video for you to show how LeakFind Pool Pros uses professional leak detection, pressure testing, water-loss diagnosis, and clear repair recommendations to find the source, stop the leak, and get your pool back to peak condition.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Pool Leak Inspection",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-pool-long/poster.webp",
          "showForm": "no",
          "slotImage": "",
          "slotVideo": "",
          "bakedPlay": "yes",
          "formTitle": "",
          "formSubtitle": "",
          "formFields": [],
          "submitLabel": "",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pc-pool-long-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Expert Leak Detection",
              "text": "Pinpoint hidden leaks in pools, spas, and plumbing",
              "value": "",
              "icon": "filter"
            },
            {
              "title": "Pressure Testing",
              "text": "Isolate and confirm leaks with professional testing",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Water-Loss Diagnosis",
              "text": "Determine exactly where you're losing water and why",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Targeted Repairs",
              "text": "Clear, honest repair recommendations that last",
              "value": "",
              "icon": "gear"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-pool-long-form",
          "eyebrow": "",
          "title": "Get a Free Pool Leak Assessment & Repair Plan",
          "text": "Enter your information below to get your personalized video, a free leak assessment, and expert repair recommendations.",
          "fields": [
            {
              "key": "name",
              "label": "First Name",
              "type": "text",
              "required": true
            },
            {
              "key": "email",
              "label": "Email Address",
              "type": "email",
              "required": true
            },
            {
              "key": "phone",
              "label": "Phone (Optional)",
              "type": "tel",
              "required": false
            },
            {
              "key": "zip",
              "label": "ZIP Code",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Pool Leak Assessment",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pc-pool-long-process",
          "variant": "split",
          "side": "left",
          "title": "Our Complete Pool Leak [[Diagnostic Process]]",
          "text": "",
          "bullets": [
            {
              "text": "Comprehensive Leak Detection – Advanced, non-invasive tools to find hidden leaks in the pool, spa, and lines."
            },
            {
              "text": "Pressure Testing – Systematic testing to isolate the exact source."
            },
            {
              "text": "Water-Loss Diagnosis – Analyze your pool's water loss and rule out evaporation or other causes."
            },
            {
              "text": "Repair Recommendations – A clear, prioritized plan with options, timing, and transparent pricing."
            }
          ],
          "buttonLabel": "",
          "buttonUrl": "#video",
          "image": "/landing-art/pc-pool-long/diag.webp",
          "imageAlt": "Pressure gauges and a leak detection screen",
          "background": "",
          "points": []
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-pool-long-why-g",
          "columns": 1,
          "items": [
            {
              "type": "ChecklistCard",
              "props": {
                "id": "pc-pool-long-why",
                "columns": 1,
                "title": "Why Homeowners Choose LeakFind Pool Pros",
                "text": "",
                "items": [
                  {
                    "label": "Local, trusted pool leak specialists",
                    "value": ""
                  },
                  {
                    "label": "Advanced, professional-grade equipment",
                    "value": ""
                  },
                  {
                    "label": "Honest, no-pressure recommendations",
                    "value": ""
                  },
                  {
                    "label": "Repairs that are built to last",
                    "value": ""
                  },
                  {
                    "label": "Fast scheduling and friendly, expert service",
                    "value": ""
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-pool-long-local",
          "eyebrow": "",
          "title": "Proudly Serving Your Local Area",
          "text": "Pool Leak Detection & Repair for Homeowners in [Your City/Region]",
          "align": "center"
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-pool-long-qh",
          "eyebrow": "",
          "title": "Trusted by Local Pool Owners Like You",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-pool-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pool-long-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "They found our pool leak the same day with pressure testing, explained everything clearly, and had it repaired fast!",
                    "name": "Melissa T., Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pool-long/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pool-long-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, thorough, and honest. The water-loss diagnosis made sense, and the repair has been solid.",
                    "name": "David R., Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pool-long/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pool-long-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Great local team! They used real leak detection tools, showed me the results, and fixed the problem right the first time.",
                    "name": "Angela M., Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pool-long/avatar3.webp"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pc-pool-long-bar",
          "text": "Ready to Find, Fix, and Stop Your Pool Leak? Get your personalized video, a free leak assessment, and a clear repair plan from LeakFind Pool Pros.",
          "label": "Get My Free Pool Leak Assessment Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
