/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-estate",
  "name": "Real estate: dream home",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar. Names, quotes and offers are sample content.",
  "designClass": "pa-estate",
  "theme": {
    "mode": "light",
    "accent": "#4a45e6",
    "highlight": "#4a45e6",
    "bg": "#ffffff",
    "text": "#0f1f3d",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-estate",
        "accent": "#4a45e6",
        "background": "#ffffff",
        "text": "#0f1f3d",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-estate-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-estate/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-estate-hero",
          "variant": "story",
          "background": "/landing-art/pa-estate/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Sarah}},\nDiscover Your Dream Home",
          "subhead": "Get a personalized video with homes in your area.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-estate/poster.webp",
          "showForm": "yes",
          "formTitle": "Get Your Free Guide",
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
          "submitLabel": "Send My Guide",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-estate-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Home Tours",
              "text": "",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Local Market Insights",
              "text": "",
              "value": "",
              "icon": "pin"
            },
            {
              "title": "Expert Advice",
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
          "id": "pa-estate-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-estate-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped me find the perfect home with a video tailored just for me.",
                    "name": "Jennifer M.",
                    "role": "",
                    "avatar": "/landing-art/pa-estate/avatar.webp"
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
          "id": "pa-estate-bar",
          "text": "",
          "label": "Book a Free Consultation",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
