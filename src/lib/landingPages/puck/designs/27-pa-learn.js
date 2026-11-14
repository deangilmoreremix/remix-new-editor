/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-learn",
  "name": "Education",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content.",
  "designClass": "pa-learn",
  "theme": {
    "mode": "light",
    "accent": "#b0179a",
    "highlight": "#b0179a",
    "bg": "#f2f6ff",
    "text": "#14224a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-learn",
        "accent": "#b0179a",
        "background": "#f2f6ff",
        "text": "#14224a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-learn-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-learn/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-learn-hero",
          "variant": "story",
          "background": "/landing-art/pa-learn/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Olivia}},\nLearn. Create. Achieve.",
          "subhead": "Get a personalized video about our learning programs.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-learn/poster.webp",
          "showForm": "yes",
          "formTitle": "Get Started Today",
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
          "submitLabel": "Learn More",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-learn-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Online Courses",
              "text": "",
              "value": "",
              "icon": "book"
            },
            {
              "title": "Expert Instructors",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Get Certified",
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
          "id": "pa-learn-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-learn-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI made learning simple and engaging.",
                    "name": "Rachel D.",
                    "role": "",
                    "avatar": "/landing-art/pa-learn/avatar.webp"
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
          "id": "pa-learn-bar",
          "text": "",
          "label": "Explore Our Courses",
          "url": "#lead",
          "icon": "book"
        }
      }
    ],
    "zones": {}
  }
};
