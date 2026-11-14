/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-agent",
  "name": "Agent: personal messages",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-agent",
  "theme": {
    "mode": "dark",
    "accent": "#7cc8ff",
    "highlight": "#7cc8ff",
    "bg": "#06122b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-agent",
        "accent": "#7cc8ff",
        "background": "#06122b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-agent-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-agent/logo.webp",
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
          "id": "pb-agent-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Turn one video into personalized messages for every prospect.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-agent/poster.webp",
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
          "id": "pb-agent-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalize at Scale",
              "text": "",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Build Your List",
              "text": "",
              "value": "",
              "icon": "users"
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
          "id": "pb-agent-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agent-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps me connect with more clients and close more deals.",
                    "name": "Michael Reeves",
                    "role": "Real Estate Agent",
                    "avatar": "/landing-art/pb-agent/avatar.webp"
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
          "id": "pb-agent-bar",
          "text": "Ready to grow your business?",
          "label": "Get Started Free",
          "url": "#lead",
          "icon": "home"
        }
      }
    ],
    "zones": {}
  }
};
