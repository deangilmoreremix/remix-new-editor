/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-creative",
  "name": "Creative studio",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content.",
  "designClass": "pa-creative",
  "theme": {
    "mode": "dark",
    "accent": "#4a3df0",
    "highlight": "#4a3df0",
    "bg": "#1a0f3a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-creative",
        "accent": "#4a3df0",
        "background": "#1a0f3a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-creative-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-creative/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-creative-hero",
          "variant": "story",
          "background": "/landing-art/pa-creative/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Alex}},\nBring Your Ideas to Life",
          "subhead": "Get a personalized video about our creative services.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-creative/poster.webp",
          "showForm": "yes",
          "formTitle": "Start a Project",
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
          "submitLabel": "Let's Create",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-creative-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Creative Solutions",
              "text": "",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Design & Video",
              "text": "",
              "value": "",
              "icon": "palette"
            },
            {
              "title": "Grow Your Brand",
              "text": "",
              "value": "",
              "icon": "rocket"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-creative-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-creative-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI turned our ideas into stunning videos.",
                    "name": "Daniel K.",
                    "role": "",
                    "avatar": "/landing-art/pa-creative/avatar.webp"
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
          "id": "pa-creative-bar",
          "text": "",
          "label": "Get in Touch",
          "url": "#lead",
          "icon": "mail"
        }
      }
    ],
    "zones": {}
  }
};
