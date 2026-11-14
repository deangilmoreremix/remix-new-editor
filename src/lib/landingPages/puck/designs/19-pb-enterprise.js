/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-enterprise",
  "name": "Enterprise: video at scale",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-enterprise",
  "theme": {
    "mode": "dark",
    "accent": "#2a7bff",
    "highlight": "#2a7bff",
    "bg": "#071a4d",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-enterprise",
        "accent": "#2a7bff",
        "background": "#071a4d",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-enterprise-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-enterprise/logo.webp",
          "links": [
            {
              "label": "Home",
              "url": ""
            },
            {
              "label": "Features",
              "url": ""
            },
            {
              "label": "Contact",
              "url": ""
            }
          ],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pb-enterprise-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Enterprise-grade video personalization at scale.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-enterprise/poster.webp",
          "showForm": "yes",
          "formTitle": "Get Your Personalized Video Today",
          "formSubtitle": "",
          "formFields": [
            {
              "key": "name",
              "label": "Your Name",
              "type": "text",
              "required": true
            },
            {
              "key": "email",
              "label": "Your Email",
              "type": "email",
              "required": true
            }
          ],
          "submitLabel": "Request a Demo",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-enterprise-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Scale Globally",
              "text": "",
              "value": "",
              "icon": "globe"
            },
            {
              "title": "Integrate Easily",
              "text": "",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Track Results",
              "text": "",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-enterprise-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-enterprise-quote",
                "columns": 1,
                "heading": "What Our Enterprise Clients Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps us communicate better with our audience.",
                    "name": "Lisa Chen",
                    "role": "VP Marketing",
                    "avatar": "/landing-art/pb-enterprise/avatar.webp"
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
          "id": "pb-enterprise-bar",
          "text": "Ready to transform your video strategy?",
          "label": "Request Demo",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
