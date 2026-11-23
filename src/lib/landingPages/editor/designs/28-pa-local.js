/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-local",
  "name": "Local shop",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pa-local",
  "theme": {
    "mode": "dark",
    "accent": "#278232",
    "highlight": "#278232",
    "bg": "#14301b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-local",
        "accent": "#278232",
        "background": "#14301b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-local-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-local/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-local-hero",
          "variant": "story",
          "background": "/landing-art/pa-local/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Amanda}},\nSupport Local. Shop Local.",
          "subhead": "Get a personalized video about our local business.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-local/poster.webp",
          "showForm": "yes",
          "formTitle": "Join Our Community",
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
          "submitLabel": "Stay Connected",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-local-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Local Events",
              "text": "",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Our Story",
              "text": "",
              "value": "",
              "icon": "heart"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-local-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-local-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A personal video that makes a difference.",
                    "name": "Brian M.",
                    "role": "",
                    "avatar": "/landing-art/pa-local/avatar.webp"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-local-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "years in town",
              "text": "",
              "value": "20+",
              "icon": ""
            },
            {
              "title": "neighbor rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            },
            {
              "title": "happy customers",
              "text": "",
              "value": "1,000+",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-local-why",
          "eyebrow": "What you get",
          "title": "Everything your neighbors needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-local-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-local-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "tag",
                    "title": "Special offers",
                    "text": "Neighborhood deals every month."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-local-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Local events",
                    "text": "Join us at the next one."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-local-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "heart",
                    "title": "Our story",
                    "text": "A family business, proudly local."
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-local-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-local-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-local-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Say hello",
                    "text": "Watch a hello from the owner.",
                    "icon": ""
                  },
                  {
                    "title": "Stop by or call",
                    "text": "Visit us or book online.",
                    "icon": ""
                  },
                  {
                    "title": "Stay connected",
                    "text": "Join our community list.",
                    "icon": ""
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-local-say",
          "eyebrow": "What people say",
          "title": "Loved by neighbors",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-local-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-local-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A personal video that makes a difference.",
                    "name": "Brian M.",
                    "role": "Neighbor",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-local-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Always friendly and fast.",
                    "name": "Carol J.",
                    "role": "Customer",
                    "avatar": ""
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-local-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-local-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-local-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Where are you located?",
                    "a": "Sample answer: add your address and hours."
                  },
                  {
                    "q": "Do you deliver?",
                    "a": "Sample answer: edit this to match your service."
                  },
                  {
                    "q": "How do I stay updated?",
                    "a": "Join our community with the form below."
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pa-local-contact",
          "eyebrow": "Let's talk",
          "title": "Join our community",
          "text": "Leave your details and we will get back to you. Sample text, edit it in the studio.",
          "fields": [
            {
              "key": "name",
              "label": "Your name",
              "type": "text",
              "required": true
            },
            {
              "key": "email",
              "label": "Your email",
              "type": "email",
              "required": true
            }
          ],
          "submitLabel": "Send",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pa-local-footer",
          "text": "© Your business · Sample footer",
          "links": [
            {
              "label": "Privacy",
              "url": ""
            },
            {
              "label": "Contact",
              "url": "#contact"
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pa-local-bar",
          "text": "",
          "label": "Follow Us",
          "url": "#lead",
          "icon": "",
          "icons": [
            {
              "icon": "facebook",
              "url": "https://facebook.com"
            },
            {
              "icon": "instagram",
              "url": "https://instagram.com"
            },
            {
              "icon": "youtube",
              "url": "https://youtube.com"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
