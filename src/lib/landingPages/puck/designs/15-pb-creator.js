/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-creator",
  "name": "Creator: stunning videos",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-creator",
  "theme": {
    "mode": "dark",
    "accent": "#6a4cff",
    "highlight": "#6a4cff",
    "bg": "#1a0b4a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-creator",
        "accent": "#6a4cff",
        "background": "#1a0b4a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-creator-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-creator/logo.webp",
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
          "id": "pb-creator-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Design stunning, personalized videos for any audience.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-creator/poster.webp",
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
          "submitLabel": "Start Creating",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-creator-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Stunning Templates",
              "text": "",
              "value": "",
              "icon": "palette"
            },
            {
              "title": "Powerful Tools",
              "text": "",
              "value": "",
              "icon": "bolt"
            },
            {
              "title": "Grow Your Brand",
              "text": "",
              "value": "",
              "icon": "star"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-creator-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-creator-quote",
                "columns": 1,
                "heading": "What Our Creators Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI gives me the creative freedom I need.",
                    "name": "Alex Morgan",
                    "role": "Content Creator",
                    "avatar": "/landing-art/pb-creator/avatar.webp"
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
          "id": "pb-creator-bar",
          "text": "Turn your ideas into personalized video experiences.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
