/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-travel",
  "name": "Travel: next getaway",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar. Names, quotes and offers are sample content.",
  "designClass": "pa-travel",
  "theme": {
    "mode": "light",
    "accent": "#f08a1c",
    "highlight": "#f08a1c",
    "bg": "#eef6fb",
    "text": "#10324a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-travel",
        "accent": "#f08a1c",
        "background": "#eef6fb",
        "text": "#10324a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-travel-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-travel/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-travel-hero",
          "variant": "story",
          "background": "/landing-art/pa-travel/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|David}},\nYour Next Getaway Awaits",
          "subhead": "Get a personalized video with our top travel destinations.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-travel/poster.webp",
          "showForm": "yes",
          "formTitle": "Plan Your Trip",
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
          "submitLabel": "Plan My Trip",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-travel-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Top Destinations",
              "text": "",
              "value": "",
              "icon": "plane"
            },
            {
              "title": "Travel Tips",
              "text": "",
              "value": "",
              "icon": "camera"
            },
            {
              "title": "Get Special Offers",
              "text": "",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-travel-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-travel-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video inspired our next vacation!",
                    "name": "Lisa P.",
                    "role": "",
                    "avatar": "/landing-art/pa-travel/avatar.webp"
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
          "id": "pa-travel-bar",
          "text": "",
          "label": "Explore More Travel Options",
          "url": "#lead",
          "icon": "plane"
        }
      }
    ],
    "zones": {}
  }
};
