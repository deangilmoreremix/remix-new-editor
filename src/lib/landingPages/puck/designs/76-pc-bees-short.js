/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-bees-short",
  "name": "Beekeeping supplies: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-bees-short",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ffc83a",
    "highlight": "#ffc83a",
    "bg": "#0b0a1f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-bees-short",
        "accent": "#ffc83a",
        "background": "#0b0a1f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-bees-short-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-bees-short/logo.webp",
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
          "id": "pc-bees-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "Build a Healthier Hive.\nGrow a Sweeter Business.\n[[Beekeeping Supplies]]",
          "subhead": "Explore hive kits, local bee-care education and seasonal supplies through a custom video prepared for your apiary.",
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
          "photo": "/landing-art/pc-bees-short/poster.webp",
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
          "id": "pc-bees-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Beginner-friendly product guidance",
              "text": "Professional guidance",
              "value": "",
              "icon": "check"
            },
            {
              "title": "Local pickup and seasonal offers",
              "text": "Easy scheduling",
              "value": "",
              "icon": "pin"
            },
            {
              "title": "How-to videos from specialists",
              "text": "Confidence and clarity",
              "value": "",
              "icon": "video"
            },
            {
              "title": "Workshop and event reminders",
              "text": "Save time with video",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-bees-short-form",
          "eyebrow": "",
          "title": "Get Your Personalized Apiary & Supplies Video",
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
          "submitLabel": "Get My Hive Starter Guide",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-bees-short-qh",
          "eyebrow": "",
          "title": "Specialized Service. Personal Approach.",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-bees-short-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-bees-short-quote1",
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
                "id": "pc-bees-short-quote2",
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
                "id": "pc-bees-short-quote3",
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
          "id": "pc-bees-short-bar",
          "text": "Ready for a smarter local service experience?",
          "label": "Get My Personalized Demo",
          "url": "#lead",
          "icon": "calendar"
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pc-bees-short-foot",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
