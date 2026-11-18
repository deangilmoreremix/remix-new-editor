/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pa-travel",
  "name": "Travel: next getaway",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar, then features, steps, testimonials, questions, a contact form and a footer. Names, quotes and offers are sample content.",
  "designClass": "pa-travel",
  "theme": {
    "mode": "light",
    "accent": "#f08a1c",
    "highlight": "#f08a1c",
    "bg": "#eef6fb",
    "text": "#10324a",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pa-travel",
        "accent": "#f08a1c",
        "background": "#eef6fb",
        "text": "#10324a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-travel-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-travel/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-travel-hero",
          "variant": "story",
          "background": "/landing-art/pa-travel/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|David}},\nYour Next Getaway Awaits",
          "subhead": "Get a personalized video with our top travel destinations.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-travel/poster.webp",
          "showForm": "yes",
          "formTitle": "Plan Your Trip",
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
          "submitLabel": "Plan My Trip",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-travel-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Top Destinations",
              "text": "",
              "value": "",
              "icon": "plane"
            },
            {
              "title": "Travel Tips",
              "text": "",
              "value": "",
              "icon": "camera"
            },
            {
              "title": "Get Special Offers",
              "text": "",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-travel-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-travel-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized video inspired our next vacation!",
                    "name": "Lisa P.",
                    "role": "",
                    "avatar": "/landing-art/pa-travel/avatar.webp"
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
          "id": "pa-travel-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "destinations",
              "text": "",
              "value": "80+",
              "icon": ""
            },
            {
              "title": "traveler rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            },
            {
              "title": "trip support",
              "text": "",
              "value": "24/7",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-travel-why",
          "eyebrow": "What you get",
          "title": "Everything your travelers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-travel-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-travel-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "plane",
                    "title": "Top destinations",
                    "text": "Hand-picked places for every season."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-travel-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "camera",
                    "title": "Travel tips",
                    "text": "Local advice before you go."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-travel-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "pin",
                    "title": "Special offers",
                    "text": "Deals on selected trips."
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
          "id": "pa-travel-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-travel-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-travel-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "See where we would send you.",
                    "icon": ""
                  },
                  {
                    "title": "Plan your trip",
                    "text": "Tell us dates and budget.",
                    "icon": ""
                  },
                  {
                    "title": "Pack your bags",
                    "text": "We handle the details.",
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
          "id": "pa-travel-say",
          "eyebrow": "What people say",
          "title": "Loved by travelers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-travel-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-travel-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The video inspired our next vacation.",
                    "name": "Lisa P.",
                    "role": "Traveler",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-travel-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Everything was handled for us.",
                    "name": "Rob and Ana",
                    "role": "Honeymooners",
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
          "id": "pa-travel-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-travel-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-travel-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can you plan a custom trip?",
                    "a": "Yes. Tell us what you want in the form below."
                  },
                  {
                    "q": "Is travel insurance included?",
                    "a": "Sample answer: edit this with your policy."
                  },
                  {
                    "q": "How far ahead should I book?",
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
          "id": "pa-travel-contact",
          "eyebrow": "Let's talk",
          "title": "Plan your trip",
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
          "id": "pa-travel-footer",
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
          "id": "pa-travel-bar",
          "text": "",
          "label": "Explore More Travel Options",
          "url": "#lead",
          "icon": "plane"
        }
      }
    ],
    "zones": {}
  }
};
