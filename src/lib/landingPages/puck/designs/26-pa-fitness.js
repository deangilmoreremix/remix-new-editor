/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-fitness",
  "name": "Fitness",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content.",
  "designClass": "pa-fitness",
  "theme": {
    "mode": "dark",
    "accent": "#7ed321",
    "highlight": "#7ed321",
    "bg": "#0a0a0a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-fitness",
        "accent": "#7ed321",
        "background": "#0a0a0a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-fitness-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-fitness/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-fitness-hero",
          "variant": "story",
          "background": "/landing-art/pa-fitness/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Chris}},\nGet Fit. Feel Great.",
          "subhead": "Watch your personalized fitness video and start today.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-fitness/poster.webp",
          "showForm": "yes",
          "formTitle": "Start Your Plan",
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
          "id": "pa-fitness-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Workouts",
              "text": "",
              "value": "",
              "icon": "dumbbell"
            },
            {
              "title": "Nutrition Tips",
              "text": "",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Track Progress",
              "text": "",
              "value": "",
              "icon": "trophy"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-fitness-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-fitness-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped me reach my fitness goals.",
                    "name": "Kevin S.",
                    "role": "",
                    "avatar": "/landing-art/pa-fitness/avatar.webp"
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
          "id": "pa-fitness-bar",
          "text": "",
          "label": "Join the Fitness Community",
          "url": "#lead",
          "icon": "users"
        }
      }
    ],
    "zones": {}
  }
};
