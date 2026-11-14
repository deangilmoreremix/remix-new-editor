/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-business",
  "name": "Business: grow together",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar. Names, quotes and offers are sample content.",
  "designClass": "pa-business",
  "theme": {
    "mode": "light",
    "accent": "#1f5fe0",
    "highlight": "#1f5fe0",
    "bg": "#eef4ff",
    "text": "#0b1f4a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-business",
        "accent": "#1f5fe0",
        "background": "#eef4ff",
        "text": "#0b1f4a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-business-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-business/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-business-hero",
          "variant": "story",
          "background": "/landing-art/pa-business/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Emily}},\nLet's Grow Together",
          "subhead": "Get a personalized video about our business solutions.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-business/poster.webp",
          "showForm": "yes",
          "formTitle": "Request a Demo",
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
          "submitLabel": "Request Demo",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-business-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Business Solutions",
              "text": "",
              "value": "",
              "icon": "handshake"
            },
            {
              "title": "Proven Results",
              "text": "",
              "value": "",
              "icon": "gear"
            },
            {
              "title": "Expert Support",
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
          "id": "pa-business-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-business-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps us connect with more clients.",
                    "name": "Amanda R.",
                    "role": "",
                    "avatar": "/landing-art/pa-business/avatar.webp"
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
          "id": "pa-business-bar",
          "text": "",
          "label": "Talk to Our Team",
          "url": "#lead",
          "icon": "phone"
        }
      }
    ],
    "zones": {}
  }
};
