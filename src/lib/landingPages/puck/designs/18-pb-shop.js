/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-shop",
  "name": "Local business: more customers",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-shop",
  "theme": {
    "mode": "light",
    "accent": "#2f9e44",
    "highlight": "#2f9e44",
    "bg": "#f4f2ec",
    "text": "#1d2b21",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-shop",
        "accent": "#2f9e44",
        "background": "#f4f2ec",
        "text": "#1d2b21",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-shop-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-shop/logo.webp",
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
          "id": "pb-shop-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Grow your local business with personalized videos.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-shop/poster.webp",
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
          "submitLabel": "Send My Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-shop-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Get More Customers",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Share Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Grow Local",
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
          "id": "pb-shop-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-shop-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI has brought more customers to my shop.",
                    "name": "Karen Davis",
                    "role": "Small Business Owner",
                    "avatar": "/landing-art/pb-shop/avatar.webp"
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
          "id": "pb-shop-bar",
          "text": "Let's grow your business together.",
          "label": "Get Started",
          "url": "#lead",
          "icon": "home"
        }
      }
    ],
    "zones": {}
  }
};
