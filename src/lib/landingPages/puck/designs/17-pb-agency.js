/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-agency",
  "name": "Agency: video marketing",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-agency",
  "theme": {
    "mode": "dark",
    "accent": "#6d4aff",
    "highlight": "#6d4aff",
    "bg": "#0b1030",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-agency",
        "accent": "#6d4aff",
        "background": "#0b1030",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-agency-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-agency/logo.webp",
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
          "id": "pb-agency-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Powerful video marketing for agencies and businesses.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-agency/poster.webp",
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
          "submitLabel": "Request Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-agency-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Scale Outreach",
              "text": "",
              "value": "",
              "icon": "rocket"
            },
            {
              "title": "Drive Engagement",
              "text": "",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Grow Revenue",
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
          "id": "pb-agency-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agency-quote",
                "columns": 1,
                "heading": "What Our Clients Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI is a game changer for our agency.",
                    "name": "Sarah Bennett",
                    "role": "Marketing Agency",
                    "avatar": "/landing-art/pb-agency/avatar.webp"
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
          "id": "pb-agency-bar",
          "text": "Take your video marketing to the next level.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
