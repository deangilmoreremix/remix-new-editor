/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-insurance",
  "name": "Insurance: compare coverage",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-insurance",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ffc43a",
    "highlight": "#ffc43a",
    "bg": "#06142e",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-insurance",
        "accent": "#ffc43a",
        "background": "#06142e",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-insurance-nav",
          "brand": "SmartVideo AI | For Insurance Agencies",
          "logo": "/landing-art/pc-insurance/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Insurance Solutions",
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
          "id": "pc-insurance-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Insurance Video for {{firstname|there}}",
          "headline": "{{firstname|there}}, Compare\nCoverage, Protect What\nMatters, and [[Get Your\nCustom Quote]]",
          "subhead": "See how our local insurance agency can help you compare options, find the right coverage for your needs, and get a personalized quote — all in just a few minutes.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Free Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-insurance/poster.webp",
          "showForm": "no",
          "formTitle": "",
          "formSubtitle": "",
          "formFields": [],
          "submitLabel": "",
          "privacy": "",
          "slotImage": "",
          "slotVideo": "",
          "bakedPlay": "yes"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pc-insurance-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Auto Insurance",
              "text": "Reliable coverage for you, your family, and your vehicles.",
              "value": "",
              "icon": "car"
            },
            {
              "title": "Home Insurance",
              "text": "Protect your home, property, and peace of mind.",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Life Insurance",
              "text": "Provide financial security for the people you love.",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Local Support",
              "text": "Friendly, expert service from a team in your community.",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-insurance-form",
          "eyebrow": "",
          "title": "Get Your Personalized Insurance Demo",
          "text": "Enter your information below to get a personalized video, custom quote, and insurance options for your needs.",
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
              "key": "coverage",
              "label": "Coverage Type",
              "type": "select",
              "required": false,
              "options": "Auto,Home,Life,Business,Bundle"
            }
          ],
          "submitLabel": "Get My Free Insurance Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-insurance-qh",
          "eyebrow": "",
          "title": "What Our Clients Say",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-insurance-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-insurance-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video made it so easy to understand my options. I got a great quote and great coverage!",
                    "name": "Melissa R., Local Client",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-insurance/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-insurance-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Friendly, knowledgeable, and truly local. They helped me bundle my home and auto and save money!",
                    "name": "James T., Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-insurance/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-insurance-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I love the personal touch and fast service. Getting a custom quote was simple and stress-free.",
                    "name": "Linda M., Local Resident",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-insurance/avatar3.webp"
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
          "id": "pc-insurance-bar",
          "text": "Get a custom quote and protect what matters most.",
          "label": "Compare Your Coverage Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
