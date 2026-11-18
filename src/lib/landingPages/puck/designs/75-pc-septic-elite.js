/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-septic-elite",
  "name": "Septic pumping: Elite one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-septic-elite",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#8cff1f",
    "highlight": "#8cff1f",
    "bg": "#04120f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-septic-elite",
        "accent": "#8cff1f",
        "background": "#04120f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-septic-elite-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-septic-elite/logo.webp",
          "links": [
            {
              "label": "Services",
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
          "loginLabel": "Schedule Service",
          "loginUrl": "#lead",
          "ctaLabel": "Get a Quote"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-septic-elite-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "Keep Your Septic System\n[[Running Smoothly]]",
          "subhead": "Reliable septic pumping, maintenance and inspections to prevent costly backups and keep your home or business worry-free.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-septic-elite/poster.webp",
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
          "id": "pc-septic-elite-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Septic Pumping",
              "text": "Fast, clean and reliable service",
              "value": "",
              "icon": "car"
            },
            {
              "title": "Maintenance",
              "text": "Keep your system running longer",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Inspections",
              "text": "Catch problems early",
              "value": "",
              "icon": "check"
            },
            {
              "title": "Peace of Mind",
              "text": "Avoid costly repairs and backups",
              "value": "",
              "icon": "shield"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-septic-elite-form",
          "eyebrow": "",
          "title": "Get Your Free Service Quote",
          "text": "Enter your information below to request a personalized video and a free service quote.",
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
          "submitLabel": "Get My Free Quote",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-septic-elite-qh",
          "eyebrow": "",
          "title": "Local homeowners trust us",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-septic-elite-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-elite-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "On time, professional and easy to work with.",
                    "name": "Local homeowner",
                    "role": "★★★★★",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-elite-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The service kept our system running well.",
                    "name": "Local homeowner",
                    "role": "★★★★★",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-elite-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Quick quote and clear next steps.",
                    "name": "Local homeowner",
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
          "id": "pc-septic-elite-bar",
          "text": "Keep your septic system healthy and worry-free.",
          "label": "Get My Free Quote",
          "url": "#lead",
          "icon": "calendar"
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pc-septic-elite-foot",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
