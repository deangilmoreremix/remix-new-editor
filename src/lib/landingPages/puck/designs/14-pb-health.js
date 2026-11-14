/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-health",
  "name": "Health: patient messages",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content.",
  "designClass": "pb-health",
  "theme": {
    "mode": "light",
    "accent": "#1f5fe0",
    "highlight": "#1f5fe0",
    "bg": "#e6eeff",
    "text": "#0f2350",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-health",
        "accent": "#1f5fe0",
        "background": "#e6eeff",
        "text": "#0f2350",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-health-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-health/logo.webp",
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
          "id": "pb-health-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Share personalized health information, offers and more.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-health/poster.webp",
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
          "id": "pb-health-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Educate Patients",
              "text": "",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Fill Appointments",
              "text": "",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Grow Your Practice",
              "text": "",
              "value": "",
              "icon": "users"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-health-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-health-quote",
                "columns": 1,
                "heading": "What Our Patients Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps our practice connect with patients in a meaningful way.",
                    "name": "Dr. Karen Mitchell",
                    "role": "Family Physician",
                    "avatar": "/landing-art/pb-health/avatar.webp"
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
          "id": "pb-health-bar",
          "text": "Better connections. A healthier community.",
          "label": "Get Started",
          "url": "#lead",
          "icon": "heart"
        }
      }
    ],
    "zones": {}
  }
};
