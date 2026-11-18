/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-grooming-short",
  "name": "Mobile pet grooming: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-grooming-short",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ff6ad5",
    "highlight": "#ff6ad5",
    "bg": "#0a0b24",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-grooming-short",
        "accent": "#ff6ad5",
        "background": "#0a0b24",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-grooming-short-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-grooming-short/logo.webp",
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
          "id": "pc-grooming-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "A Fresh, Happy Pup.\nRight at Your Door. [[Mobile Pet Grooming]]",
          "subhead": "A personalized welcome video with grooming packages, neighborhood routes and an easy way to reserve your pet's next appointment.",
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
          "photo": "/landing-art/pc-grooming-short/poster.webp",
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
          "id": "pc-grooming-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Convenient doorstep service",
              "text": "Professional guidance",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Calm one-on-one appointments",
              "text": "Easy scheduling",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Personalized care for every pet",
              "text": "Confidence and clarity",
              "value": "",
              "icon": "star"
            },
            {
              "title": "Easy rebooking and reminders",
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
          "id": "pc-grooming-short-form",
          "eyebrow": "",
          "title": "Get Your Personalized Pet Services Video",
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
          "submitLabel": "Get My Grooming Offer",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-grooming-short-qh",
          "eyebrow": "",
          "title": "Specialized Service. Personal Approach.",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-grooming-short-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-grooming-short-quote1",
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
                "id": "pc-grooming-short-quote2",
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
                "id": "pc-grooming-short-quote3",
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
          "id": "pc-grooming-short-bar",
          "text": "Ready for a smarter local service experience?",
          "label": "Get My Personalized Demo",
          "url": "#lead",
          "icon": "calendar"
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pc-grooming-short-foot",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
