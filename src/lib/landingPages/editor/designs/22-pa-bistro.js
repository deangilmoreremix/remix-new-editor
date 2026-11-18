/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-bistro",
  "name": "Restaurant: Bella Bistro",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar, then features, steps, testimonials, questions, a contact form and a footer. Names, quotes and offers are sample content.",
  "designClass": "pa-bistro",
  "theme": {
    "mode": "dark",
    "accent": "#d92b2b",
    "highlight": "#d92b2b",
    "bg": "#2a150c",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-bistro",
        "accent": "#d92b2b",
        "background": "#2a150c",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-bistro-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-bistro/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-bistro-hero",
          "variant": "story",
          "background": "/landing-art/pa-bistro/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Michael}},\nWelcome to Bella Bistro",
          "subhead": "Enjoy a personalized video from our restaurant.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-bistro/poster.webp",
          "showForm": "yes",
          "formTitle": "Reserve Your Table",
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
          "submitLabel": "Book Now",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-bistro-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Our Menu",
              "text": "",
              "value": "",
              "icon": "cutlery"
            },
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "star"
            },
            {
              "title": "Make a Reservation",
              "text": "",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-bistro-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-bistro-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video made me feel like a valued guest.",
                    "name": "David K.",
                    "role": "",
                    "avatar": "/landing-art/pa-bistro/avatar.webp"
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
          "id": "pa-bistro-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "repeat visits",
              "text": "",
              "value": "2x",
              "icon": ""
            },
            {
              "title": "guest rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            },
            {
              "title": "minutes to a table",
              "text": "",
              "value": "15",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-bistro-why",
          "eyebrow": "What you get",
          "title": "Everything your guests needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-bistro-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-bistro-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "cutlery",
                    "title": "Our menu",
                    "text": "Seasonal dishes made fresh every day."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-bistro-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "star",
                    "title": "Special offers",
                    "text": "Members get early access to events."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-bistro-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Easy reservations",
                    "text": "Book a table in a few taps."
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
          "id": "pa-bistro-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-bistro-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-bistro-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Say hello",
                    "text": "Watch a short welcome from the chef.",
                    "icon": ""
                  },
                  {
                    "title": "Pick a time",
                    "text": "Choose your date and party size.",
                    "icon": ""
                  },
                  {
                    "title": "Enjoy the evening",
                    "text": "We will have your table ready.",
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
          "id": "pa-bistro-say",
          "eyebrow": "What people say",
          "title": "Loved by guests",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-bistro-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-bistro-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The video made me feel like a valued guest.",
                    "name": "David K.",
                    "role": "Regular guest",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-bistro-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Booking was effortless.",
                    "name": "Sofia L.",
                    "role": "Guest",
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
          "id": "pa-bistro-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-bistro-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-bistro-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Do I need to book ahead?",
                    "a": "Sample answer: edit this to match your policy."
                  },
                  {
                    "q": "Do you take large groups?",
                    "a": "Sample answer: tell us in the form below."
                  },
                  {
                    "q": "Is there parking?",
                    "a": "Sample answer: edit this with your details."
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
          "id": "pa-bistro-contact",
          "eyebrow": "Let's talk",
          "title": "Reserve your table",
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
          "id": "pa-bistro-footer",
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
          "id": "pa-bistro-bar",
          "text": "",
          "label": "Join Our VIP List",
          "url": "#lead",
          "icon": "mail"
        }
      }
    ],
    "zones": {}
  }
};
