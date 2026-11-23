/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-pool-short",
  "name": "Pool leak detection: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-pool-short",
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
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-pool-short",
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
          "id": "pc-pool-short-nav",
          "brand": "LeakFind Pool Pros",
          "logo": "/landing-art/pc-pool-short/logo.webp",
          "links": [
            {
              "label": "Leak Detection",
              "url": ""
            },
            {
              "label": "Repairs",
              "url": ""
            },
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Reviews",
              "url": ""
            }
          ],
          "loginLabel": "Schedule Inspection",
          "loginUrl": "#lead",
          "ctaLabel": "Get Assessment"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-pool-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Find & Fix\nYour Pool Leak—Fast with\n[[LeakFind Pool Pros]]",
          "subhead": "Professional leak detection, pressure testing, water-loss diagnosis, and expert pool repairs — all from your local pool leak specialists. Schedule an inspection today!",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-pool-short/poster.webp",
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
          "id": "pc-pool-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Precise Leak Detection",
              "text": "Finds hidden leaks fast",
              "value": "",
              "icon": "filter"
            },
            {
              "title": "Pressure Testing",
              "text": "Pinpoints the problem",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Water-Loss Diagnosis",
              "text": "Know exactly where your water is going",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Expert Pool Repairs",
              "text": "Durable, long-term fixes",
              "value": "",
              "icon": "gear"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-pool-short-form",
          "eyebrow": "",
          "title": "Get Your Free Pool Leak Assessment",
          "text": "Enter your information below to get a free pool leak assessment and schedule your inspection.",
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
              "label": "Phone",
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
        "type": "TextBlock",
        "props": {
          "id": "pc-pool-short-qh",
          "eyebrow": "",
          "title": "Trusted by Local Pool Owners",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-pool-short-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pool-short-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "They found our leak the same day with pressure testing and had it repaired quickly!",
                    "name": "Melissa T.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pool-short/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pool-short-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, thorough, and honest. Our water loss stopped immediately after the repair.",
                    "name": "Brian R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pool-short/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pool-short-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The team explained the leak diagnosis clearly and got our pool back to perfect in no time!",
                    "name": "Karen D.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pool-short/avatar3.webp"
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
          "id": "pc-pool-short-bar",
          "text": "Ready to Stop Pool Water Loss? Schedule your pool leak inspection with LeakFind Pool Pros today!",
          "label": "Schedule My Inspection Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
