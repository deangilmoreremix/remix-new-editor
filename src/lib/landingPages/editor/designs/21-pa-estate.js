/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-estate",
  "name": "Real estate: dream home",
  "description": "Phone-first industry page with a photo hero, video card, form, tiles and a bottom button bar, then features, steps, testimonials, questions, a contact form and a footer. Names, quotes and offers are sample content.",
  "designClass": "pa-estate",
  "theme": {
    "mode": "light",
    "accent": "#4a45e6",
    "highlight": "#4a45e6",
    "bg": "#ffffff",
    "text": "#0f1f3d",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-estate",
        "accent": "#4a45e6",
        "background": "#ffffff",
        "text": "#0f1f3d",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-estate-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-estate/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-estate-hero",
          "variant": "story",
          "background": "/landing-art/pa-estate/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Sarah}},\nDiscover Your Dream Home",
          "subhead": "Get a personalized video with homes in your area.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-estate/poster.webp",
          "showForm": "yes",
          "formTitle": "Get Your Free Guide",
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
          "submitLabel": "Send My Guide",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-estate-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Home Tours",
              "text": "",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Local Market Insights",
              "text": "",
              "value": "",
              "icon": "pin"
            },
            {
              "title": "Expert Advice",
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
          "id": "pa-estate-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-estate-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped me find the perfect home with a video tailored just for me.",
                    "name": "Jennifer M.",
                    "role": "",
                    "avatar": "/landing-art/pa-estate/avatar.webp"
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
          "id": "pa-estate-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "more replies",
              "text": "",
              "value": "3x",
              "icon": ""
            },
            {
              "title": "to first showing",
              "text": "",
              "value": "24h",
              "icon": ""
            },
            {
              "title": "watch to the end",
              "text": "",
              "value": "92%",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-estate-why",
          "eyebrow": "What you get",
          "title": "Everything your home buyers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-estate-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-estate-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "home",
                    "title": "Property showcases",
                    "text": "Highlight homes that match each buyer."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-estate-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "pin",
                    "title": "Local market insights",
                    "text": "Share neighborhoods, schools and prices."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-estate-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "Expert advice",
                    "text": "Guide buyers from first look to keys."
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
          "id": "pa-estate-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-estate-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-estate-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Pick a home",
                    "text": "Choose the listing or area.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add the buyer name and message.",
                    "icon": ""
                  },
                  {
                    "title": "Book a tour",
                    "text": "They schedule from the page.",
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
          "id": "pa-estate-say",
          "eyebrow": "What people say",
          "title": "Loved by home buyers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-estate-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-estate-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I booked a showing the same day.",
                    "name": "Jennifer M.",
                    "role": "Home buyer",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-estate-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "It felt like the agent made it just for me.",
                    "name": "Carlos R.",
                    "role": "First-time buyer",
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
          "id": "pa-estate-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-estate-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-estate-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Is the home tour free?",
                    "a": "Sample answer: edit this to match your offer."
                  },
                  {
                    "q": "Can I see more homes?",
                    "a": "Yes. Ask for more in the form below."
                  },
                  {
                    "q": "How fast will you reply?",
                    "a": "Sample answer: usually within one business day."
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
          "id": "pa-estate-contact",
          "eyebrow": "Let's talk",
          "title": "Get your free guide",
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
          "id": "pa-estate-footer",
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
          "id": "pa-estate-bar",
          "text": "",
          "label": "Book a Free Consultation",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
