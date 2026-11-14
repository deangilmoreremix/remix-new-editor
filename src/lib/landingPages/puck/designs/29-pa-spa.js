/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-spa",
  "name": "Spa",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content.",
  "designClass": "pa-spa",
  "theme": {
    "mode": "light",
    "accent": "#d9a63f",
    "highlight": "#d9a63f",
    "bg": "#f7f0e6",
    "text": "#3b2a1a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-spa",
        "accent": "#d9a63f",
        "background": "#f7f0e6",
        "text": "#3b2a1a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-spa-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-spa/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-spa-hero",
          "variant": "story",
          "background": "/landing-art/pa-spa/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Sophia}},\nRelax. Rejuvenate. Feel Beautiful.",
          "subhead": "Get a personalized video about our spa services.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-spa/poster.webp",
          "showForm": "yes",
          "formTitle": "Book Your Spa Day",
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
          "id": "pa-spa-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Our Services",
              "text": "",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Wellness Tips",
              "text": "",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-spa-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-spa-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video made my spa experience special.",
                    "name": "Michelle T.",
                    "role": "",
                    "avatar": "/landing-art/pa-spa/avatar.webp"
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
          "id": "pa-spa-bar",
          "text": "",
          "label": "Discover Wellness",
          "url": "#lead",
          "icon": "sparkles"
        }
      }
    ],
    "zones": {}
  }
};
