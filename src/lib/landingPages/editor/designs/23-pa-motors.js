/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-motors",
  "name": "Car dealer: next car",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar, then features, steps, testimonials, questions, a contact form and a footer. Names, quotes and offers are sample content.",
  "designClass": "pa-motors",
  "theme": {
    "mode": "dark",
    "accent": "#1f6df0",
    "highlight": "#1f6df0",
    "bg": "#0a1a3d",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-motors",
        "accent": "#1f6df0",
        "background": "#0a1a3d",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-motors-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-motors/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-motors-hero",
          "variant": "story",
          "background": "/landing-art/pa-motors/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|James}},\nTake the Wheel of Your Next Car",
          "subhead": "Get a personalized video with the latest models.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-motors/poster.webp",
          "showForm": "yes",
          "formTitle": "Get a Quote",
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
          "submitLabel": "Get My Quote",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-motors-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "New & Used Inventory",
              "text": "",
              "value": "",
              "icon": "car"
            },
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "star"
            },
            {
              "title": "Schedule a Test Drive",
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
          "id": "pa-motors-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-motors-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A personalized video made car shopping easy!",
                    "name": "Mark T.",
                    "role": "",
                    "avatar": "/landing-art/pa-motors/avatar.webp"
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
          "id": "pa-motors-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "more test drives",
              "text": "",
              "value": "45%",
              "icon": ""
            },
            {
              "title": "average reply",
              "text": "",
              "value": "2h",
              "icon": ""
            },
            {
              "title": "dealer rating",
              "text": "",
              "value": "4.8",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-motors-why",
          "eyebrow": "What you get",
          "title": "Everything your drivers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-motors-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-motors-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "car",
                    "title": "New and used inventory",
                    "text": "Find the right car for your budget."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-motors-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "tag",
                    "title": "Special offers",
                    "text": "Current deals on selected models."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-motors-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Test drives",
                    "text": "Book a time that suits you."
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
          "id": "pa-motors-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-motors-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-motors-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "See the car we picked for you.",
                    "icon": ""
                  },
                  {
                    "title": "Choose a time",
                    "text": "Book your test drive.",
                    "icon": ""
                  },
                  {
                    "title": "Drive away",
                    "text": "We will have it ready.",
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
          "id": "pa-motors-say",
          "eyebrow": "What people say",
          "title": "Loved by drivers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-motors-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-motors-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The car was waiting for me and ready to drive.",
                    "name": "Mark T.",
                    "role": "Customer",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-motors-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Clear prices and no pressure.",
                    "name": "Dina H.",
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
          "id": "pa-motors-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-motors-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-motors-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Do you accept trade-ins?",
                    "a": "Sample answer: edit this to match your policy."
                  },
                  {
                    "q": "Can I get financing?",
                    "a": "Sample answer: edit this with your options."
                  },
                  {
                    "q": "Can I book by phone?",
                    "a": "Yes. Add your number in the contact block."
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
          "id": "pa-motors-contact",
          "eyebrow": "Let's talk",
          "title": "Book a test drive",
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
          "id": "pa-motors-footer",
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
          "id": "pa-motors-bar",
          "text": "",
          "label": "Schedule a Test Drive",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
