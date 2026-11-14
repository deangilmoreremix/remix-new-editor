/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-bistro",
  "name": "Restaurant: Bella Bistro",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar. Names, quotes and offers are sample content.",
  "designClass": "pa-bistro",
  "theme": {
    "mode": "dark",
    "accent": "#d92b2b",
    "highlight": "#d92b2b",
    "bg": "#2a150c",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-bistro",
        "accent": "#d92b2b",
        "background": "#2a150c",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-bistro-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-bistro/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-bistro-hero",
          "variant": "story",
          "background": "/landing-art/pa-bistro/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Michael}},\nWelcome to Bella Bistro",
          "subhead": "Enjoy a personalized video from our restaurant.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-bistro/poster.webp",
          "showForm": "yes",
          "formTitle": "Reserve Your Table",
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
          "submitLabel": "Book Now",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-bistro-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Our Menu",
              "text": "",
              "value": "",
              "icon": "cutlery"
            },
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "star"
            },
            {
              "title": "Make a Reservation",
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
          "id": "pa-bistro-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-bistro-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video made me feel like a valued guest.",
                    "name": "David K.",
                    "role": "",
                    "avatar": "/landing-art/pa-bistro/avatar.webp"
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
          "id": "pa-bistro-bar",
          "text": "",
          "label": "Join Our VIP List",
          "url": "#lead",
          "icon": "mail"
        }
      }
    ],
    "zones": {}
  }
};
