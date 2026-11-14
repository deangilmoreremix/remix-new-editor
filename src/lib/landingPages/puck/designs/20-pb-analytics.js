/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-analytics",
  "name": "Analytics: track and grow",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-analytics",
  "theme": {
    "mode": "dark",
    "accent": "#5a6cff",
    "highlight": "#5a6cff",
    "bg": "#0b0f4a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-analytics",
        "accent": "#5a6cff",
        "background": "#0b0f4a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-analytics-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-analytics/logo.webp",
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
          "id": "pb-analytics-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Track, optimize and grow with personalized video.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-analytics/poster.webp",
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
          "submitLabel": "Get Started",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-analytics-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Track Performance",
              "text": "",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Optimize Results",
              "text": "",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Grow Revenue",
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
          "id": "pb-analytics-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-analytics-quote",
                "columns": 1,
                "heading": "What Our Users Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI gives me the insights we need to grow.",
                    "name": "Emily Carter",
                    "role": "Growth Strategist",
                    "avatar": "/landing-art/pb-analytics/avatar.webp"
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
          "id": "pb-analytics-bar",
          "text": "Turn more viewers into loyal customers.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
