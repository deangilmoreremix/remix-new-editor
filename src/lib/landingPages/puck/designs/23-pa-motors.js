/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-motors",
  "name": "Car dealer: next car",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar. Names, quotes and offers are sample content.",
  "designClass": "pa-motors",
  "theme": {
    "mode": "dark",
    "accent": "#1f6df0",
    "highlight": "#1f6df0",
    "bg": "#0a1a3d",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-motors",
        "accent": "#1f6df0",
        "background": "#0a1a3d",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-motors-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-motors/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-motors-hero",
          "variant": "story",
          "background": "/landing-art/pa-motors/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|James}},\nTake the Wheel of Your Next Car",
          "subhead": "Get a personalized video with the latest models.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-motors/poster.webp",
          "showForm": "yes",
          "formTitle": "Get a Quote",
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
          "submitLabel": "Get My Quote",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-motors-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "New & Used Inventory",
              "text": "",
              "value": "",
              "icon": "car"
            },
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "star"
            },
            {
              "title": "Schedule a Test Drive",
              "text": "",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-motors-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-motors-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A personalized video made car shopping easy!",
                    "name": "Mark T.",
                    "role": "",
                    "avatar": "/landing-art/pa-motors/avatar.webp"
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
          "id": "pa-motors-bar",
          "text": "",
          "label": "Schedule a Test Drive",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
