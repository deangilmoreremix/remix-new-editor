/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-septic-short",
  "name": "Septic pumping: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-septic-short",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ff8a1f",
    "highlight": "#ff8a1f",
    "bg": "#06122b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-septic-short",
        "accent": "#ff8a1f",
        "background": "#06122b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-septic-short-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-septic-short/logo.webp",
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
              "label": "Pricing",
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
          "id": "pc-septic-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Keep Your\nSeptic System Running\nSmoothly with [[ClearFlow Septic]]",
          "subhead": "A quick, personalized video showing how ClearFlow Septic helps local homeowners with professional septic pumping, thorough inspections, avoiding costly backups, staying compliant with local regulations, and convenient maintenance plans.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-septic-short/poster.webp",
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
          "id": "pc-septic-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Septic Pumping",
              "text": "Keep your system clean, healthy, and problem-free",
              "value": "",
              "icon": "car"
            },
            {
              "title": "System Inspections",
              "text": "Catch issues early and stay compliant",
              "value": "",
              "icon": "check"
            },
            {
              "title": "Avoid Costly Backups",
              "text": "Prevent overflows, damage, and messy emergencies",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Maintenance Plans",
              "text": "Scheduled service for long-term peace of mind",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-septic-short-form",
          "eyebrow": "",
          "title": "Get a Free Septic Quote from ClearFlow Septic",
          "text": "",
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
          "submitLabel": "Get My Free Septic Quote",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-septic-short-qh",
          "eyebrow": "",
          "title": "Local Homeowners Trust ClearFlow Septic",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-septic-short-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-short-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "On time, professional, and super easy to work with. The pumping and inspection gave us peace of mind, and we haven't had a single issue since!",
                    "name": "Melissa T., Local Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-septic-short/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-short-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "ClearFlow keeps our septic system on a maintenance plan, so we stay compliant and avoid any surprise backups. Highly recommend!",
                    "name": "Brian K., Local Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-septic-short/avatar2.webp"
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
          "id": "pc-septic-short-bar",
          "text": "Keep Your Septic System Healthy, Compliant, and Worry-Free!",
          "label": "Get My Free Septic Quote Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
