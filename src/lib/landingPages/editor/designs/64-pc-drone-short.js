/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-drone-short",
  "name": "Drone property inspection: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-drone-short",
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
        "design": "pc-drone-short",
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
          "id": "pc-drone-short-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-drone-short/logo.webp",
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
          "id": "pc-drone-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "See Every Detail.\nMake Smarter Property\nDecisions. [[Drone Property Inspections]]",
          "subhead": "Personalized aerial property videos, roof assessments and clear inspection reports delivered without the guesswork.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Local Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-drone-short/poster.webp",
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
          "id": "pc-drone-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "High-resolution aerial video",
              "text": "Professional guidance",
              "value": "",
              "icon": "check"
            },
            {
              "title": "Hard-to-reach areas viewed safely",
              "text": "Easy scheduling",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Clear shareable inspection reports",
              "text": "Confidence and clarity",
              "value": "",
              "icon": "camera"
            },
            {
              "title": "Fast scheduling and delivery",
              "text": "Save time with video",
              "value": "",
              "icon": "clock"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-drone-short-form",
          "eyebrow": "",
          "title": "Get Your Personalized Property Inspection Video",
          "text": "Enter your information below to request a personalized video, free resources, and a local service quote.",
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
            }
          ],
          "submitLabel": "Get My Free Aerial Assessment",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-drone-short-qh",
          "eyebrow": "",
          "title": "Specialized Service. Personal Approach.",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-drone-short-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-drone-short-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Easy to understand, easy to connect.",
                    "name": "Local expertise",
                    "role": "★★★★★",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-drone-short-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "See your options before scheduling.",
                    "name": "Clear next steps",
                    "role": "★★★★★",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-drone-short-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Personalized answers for your needs.",
                    "name": "Convenient service",
                    "role": "★★★★★",
                    "avatar": ""
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
          "id": "pc-drone-short-bar",
          "text": "Ready for a smarter local service experience?",
          "label": "Get My Personalized Demo",
          "url": "#lead",
          "icon": "calendar"
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pc-drone-short-foot",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
