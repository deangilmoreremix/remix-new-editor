/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-spa",
  "name": "Spa",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pa-spa",
  "theme": {
    "mode": "light",
    "accent": "#d9a63f",
    "highlight": "#d9a63f",
    "bg": "#f7f0e6",
    "text": "#3b2a1a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-spa",
        "accent": "#d9a63f",
        "background": "#f7f0e6",
        "text": "#3b2a1a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-spa-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-spa/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-spa-hero",
          "variant": "story",
          "background": "/landing-art/pa-spa/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Sophia}},\nRelax. Rejuvenate. Feel Beautiful.",
          "subhead": "Get a personalized video about our spa services.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-spa/poster.webp",
          "showForm": "yes",
          "formTitle": "Book Your Spa Day",
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
          "id": "pa-spa-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Our Services",
              "text": "",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Wellness Tips",
              "text": "",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Special Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-spa-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-spa-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video made my spa experience special.",
                    "name": "Michelle T.",
                    "role": "",
                    "avatar": "/landing-art/pa-spa/avatar.webp"
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
          "id": "pa-spa-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "guest rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            },
            {
              "title": "treatments given",
              "text": "",
              "value": "10k",
              "icon": ""
            },
            {
              "title": "to feel renewed",
              "text": "",
              "value": "60 min",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-spa-why",
          "eyebrow": "What you get",
          "title": "Everything your guests needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-spa-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-spa-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "leaf",
                    "title": "Our services",
                    "text": "Massage, facials and body treatments."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-spa-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "heart",
                    "title": "Wellness tips",
                    "text": "Simple rituals for every day."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-spa-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "tag",
                    "title": "Special offers",
                    "text": "Seasonal packages and gift cards."
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
          "id": "pa-spa-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-spa-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-spa-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "Take a moment to unwind.",
                    "icon": ""
                  },
                  {
                    "title": "Choose a treatment",
                    "text": "Pick the service that suits you.",
                    "icon": ""
                  },
                  {
                    "title": "Book your day",
                    "text": "Reserve your spa day in a few taps.",
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
          "id": "pa-spa-say",
          "eyebrow": "What people say",
          "title": "Loved by guests",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-spa-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-spa-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The experience was truly special.",
                    "name": "Michelle T.",
                    "role": "Guest",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-spa-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I booked again before I left.",
                    "name": "Hana O.",
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
          "id": "pa-spa-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-spa-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-spa-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "How do I book?",
                    "a": "Use the form below or call us."
                  },
                  {
                    "q": "Do you offer gift cards?",
                    "a": "Sample answer: edit this to match your offer."
                  },
                  {
                    "q": "What should I bring?",
                    "a": "Sample answer: edit this with your advice."
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
          "id": "pa-spa-contact",
          "eyebrow": "Let's talk",
          "title": "Book your spa day",
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
          "id": "pa-spa-footer",
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
          "id": "pa-spa-bar",
          "text": "",
          "label": "Discover Wellness",
          "url": "#lead",
          "icon": "sparkles"
        }
      }
    ],
    "zones": {}
  }
};
