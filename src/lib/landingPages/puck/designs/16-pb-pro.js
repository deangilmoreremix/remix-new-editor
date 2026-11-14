/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-pro",
  "name": "Simple: trusted by professionals",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-pro",
  "theme": {
    "mode": "light",
    "accent": "#0b1020",
    "highlight": "#0b1020",
    "bg": "#ffffff",
    "text": "#0f172a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-pro",
        "accent": "#0b1020",
        "background": "#ffffff",
        "text": "#0f172a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-pro-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-pro/logo.webp",
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
          "id": "pb-pro-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Simple. Powerful. Effective.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-pro/poster.webp",
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
          "id": "pb-pro-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Create Videos",
              "text": "",
              "value": "",
              "icon": "play"
            },
            {
              "title": "Build Your List",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Grow Faster",
              "text": "",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-pro-logos",
          "kind": "logos",
          "title": "Trusted by Professionals",
          "items": [
            {
              "title": "Google",
              "text": "",
              "value": "",
              "icon": ""
            },
            {
              "title": "Microsoft",
              "text": "",
              "value": "",
              "icon": ""
            },
            {
              "title": "Apple",
              "text": "",
              "value": "",
              "icon": ""
            },
            {
              "title": "Meta",
              "text": "",
              "value": "",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pb-pro-bar",
          "text": "Start today and see the difference.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
