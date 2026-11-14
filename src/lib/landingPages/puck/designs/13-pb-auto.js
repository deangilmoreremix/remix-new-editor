/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-auto",
  "name": "Auto dealer: more sales",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-auto",
  "theme": {
    "mode": "dark",
    "accent": "#e0242b",
    "highlight": "#e0242b",
    "bg": "#070a12",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-auto",
        "accent": "#e0242b",
        "background": "#070a12",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-auto-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-auto/logo.webp",
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
          "id": "pb-auto-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Turn your video into personalized outreach for more sales.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-auto/poster.webp",
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
          "submitLabel": "Watch My Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-auto-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Generate More Leads",
              "text": "",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Increase Sales",
              "text": "",
              "value": "",
              "icon": "handshake"
            },
            {
              "title": "Grow Your Business",
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
          "id": "pb-auto-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-auto-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps me connect with more buyers and close more deals.",
                    "name": "David Parker",
                    "role": "Auto Dealer",
                    "avatar": "/landing-art/pb-auto/avatar.webp"
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
          "id": "pb-auto-bar",
          "text": "Drive more sales with personalized videos.",
          "label": "Get Started",
          "url": "#lead",
          "icon": "car"
        }
      }
    ],
    "zones": {}
  }
};
