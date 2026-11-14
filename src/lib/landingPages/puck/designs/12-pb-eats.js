/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-eats",
  "name": "Restaurant: invitations",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-eats",
  "theme": {
    "mode": "dark",
    "accent": "#f0701b",
    "highlight": "#f0701b",
    "bg": "#1c100b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-eats",
        "accent": "#f0701b",
        "background": "#1c100b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-eats-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-eats/logo.webp",
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
          "id": "pb-eats-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Turn your video into personalized invitations, offers and more.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-eats/poster.webp",
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
          "submitLabel": "Send Me My Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-eats-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Attract More Guests",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Share Special Offers",
              "text": "",
              "value": "",
              "icon": "tag"
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
          "id": "pb-eats-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-eats-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI has helped us fill more tables and increase our sales.",
                    "name": "Jessica Martinez",
                    "role": "Restaurant Owner",
                    "avatar": "/landing-art/pb-eats/avatar.webp"
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
          "id": "pb-eats-bar",
          "text": "Bring more customers to your restaurant.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
