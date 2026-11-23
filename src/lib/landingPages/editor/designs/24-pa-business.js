/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-business",
  "name": "Business: grow together",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar, then features, steps, testimonials, questions, a contact form and a footer. Names, quotes and offers are sample content.",
  "designClass": "pa-business",
  "theme": {
    "mode": "light",
    "accent": "#1f5fe0",
    "highlight": "#1f5fe0",
    "bg": "#eef4ff",
    "text": "#0b1f4a",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-business",
        "accent": "#1f5fe0",
        "background": "#eef4ff",
        "text": "#0b1f4a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-business-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-business/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-business-hero",
          "variant": "story",
          "background": "/landing-art/pa-business/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Emily}},\nLet's Grow Together",
          "subhead": "Get a personalized video about our business solutions.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-business/poster.webp",
          "showForm": "yes",
          "formTitle": "Request a Demo",
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
          "submitLabel": "Request Demo",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-business-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Business Solutions",
              "text": "",
              "value": "",
              "icon": "handshake"
            },
            {
              "title": "Proven Results",
              "text": "",
              "value": "",
              "icon": "gear"
            },
            {
              "title": "Expert Support",
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
          "id": "pa-business-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-business-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps us connect with more clients.",
                    "name": "Amanda R.",
                    "role": "",
                    "avatar": "/landing-art/pa-business/avatar.webp"
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
          "id": "pa-business-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "more inquiries",
              "text": "",
              "value": "3x",
              "icon": ""
            },
            {
              "title": "to a plan",
              "text": "",
              "value": "48h",
              "icon": ""
            },
            {
              "title": "client rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-business-why",
          "eyebrow": "What you get",
          "title": "Everything your business owners needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-business-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-business-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "layers",
                    "title": "Business solutions",
                    "text": "Tools that fit how you work."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-business-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "Proven results",
                    "text": "Clear numbers you can share."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-business-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "users",
                    "title": "Expert support",
                    "text": "Real people, ready to help."
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
          "id": "pa-business-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-business-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-business-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "See how we can help.",
                    "icon": ""
                  },
                  {
                    "title": "Share your goals",
                    "text": "Tell us what you need.",
                    "icon": ""
                  },
                  {
                    "title": "Get a plan",
                    "text": "We will follow up with next steps.",
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
          "id": "pa-business-say",
          "eyebrow": "What people say",
          "title": "Loved by business owners",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-business-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-business-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps us connect with more clients.",
                    "name": "Amanda R.",
                    "role": "Owner",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-business-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Simple to use and very effective.",
                    "name": "Greg P.",
                    "role": "Director",
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
          "id": "pa-business-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-business-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-business-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Who is this for?",
                    "a": "Sample answer: describe your ideal customer."
                  },
                  {
                    "q": "How much does it cost?",
                    "a": "Sample answer: edit this with your pricing."
                  },
                  {
                    "q": "Can I book a demo?",
                    "a": "Yes. Use the form below."
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
          "id": "pa-business-contact",
          "eyebrow": "Let's talk",
          "title": "Request a demo",
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
          "id": "pa-business-footer",
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
          "id": "pa-business-bar",
          "text": "",
          "label": "Talk to Our Team",
          "url": "#lead",
          "icon": "phone"
        }
      }
    ],
    "zones": {}
  }
};
