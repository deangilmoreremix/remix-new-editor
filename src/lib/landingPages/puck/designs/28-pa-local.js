/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-local",
  "name": "Local shop",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content.",
  "designClass": "pa-local",
  "theme": {
    "mode": "dark",
    "accent": "#278232",
    "highlight": "#278232",
    "bg": "#14301b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-local",
        "accent": "#278232",
        "background": "#14301b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-local-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-local/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-local-hero",
          "variant": "story",
          "background": "/landing-art/pa-local/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Amanda}},\nSupport Local. Shop Local.",
          "subhead": "Get a personalized video about our local business.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-local/poster.webp",
          "showForm": "yes",
          "formTitle": "Join Our Community",
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
          "submitLabel": "Stay Connected",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-local-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Local Events",
              "text": "",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Our Story",
              "text": "",
              "value": "",
              "icon": "heart"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-local-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-local-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A personal video that makes a difference.",
                    "name": "Brian M.",
                    "role": "",
                    "avatar": "/landing-art/pa-local/avatar.webp"
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
          "id": "pa-local-bar",
          "text": "",
          "label": "Follow Us",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
