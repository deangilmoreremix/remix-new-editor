/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pb-pro",
  "name": "Simple: trusted by professionals",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-pro",
  "theme": {
    "mode": "light",
    "accent": "#0b1020",
    "highlight": "#0b1020",
    "bg": "#ffffff",
    "text": "#0f172a",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pb-pro",
        "accent": "#0b1020",
        "background": "#ffffff",
        "text": "#0f172a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-pro-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-pro/logo.webp",
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
          "id": "pb-pro-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Simple. Powerful. Effective.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-pro/poster.webp",
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
          "id": "pb-pro-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Create Videos",
              "text": "",
              "value": "",
              "icon": "play"
            },
            {
              "title": "Build Your List",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Grow Faster",
              "text": "",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-pro-logos",
          "kind": "logos",
          "title": "Trusted by Professionals",
          "items": [
            {
              "title": "Google",
              "text": "",
              "value": "",
              "icon": ""
            },
            {
              "title": "Microsoft",
              "text": "",
              "value": "",
              "icon": ""
            },
            {
              "title": "Apple",
              "text": "",
              "value": "",
              "icon": ""
            },
            {
              "title": "Meta",
              "text": "",
              "value": "",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-pro-stats",
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
              "title": "to a booked call",
              "text": "",
              "value": "48h",
              "icon": ""
            },
            {
              "title": "open the video",
              "text": "",
              "value": "90%",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-pro-why",
          "eyebrow": "What you get",
          "title": "Everything your clients needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-pro-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-pro-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "handshake",
                    "title": "Warm introductions",
                    "text": "Open every conversation with a personal video."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-pro-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Book a call",
                    "text": "Prospects pick a time on the page."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-pro-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "Know who engaged",
                    "text": "See who watched before you call."
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
          "id": "pb-pro-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-pro-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-pro-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Record your pitch",
                    "text": "A short, friendly video.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add the name and company.",
                    "icon": ""
                  },
                  {
                    "title": "Follow up",
                    "text": "Reach out when they watch.",
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
          "id": "pb-pro-say",
          "eyebrow": "What people say",
          "title": "Loved by clients and prospects",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-pro-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-pro-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "It turned cold outreach into real conversations.",
                    "name": "Rachel K.",
                    "role": "Consultant",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-pro-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Clients love the personal touch.",
                    "name": "Omar D.",
                    "role": "Advisor",
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
          "id": "pb-pro-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-pro-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-pro-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can I import a list?",
                    "a": "Yes. Upload a CSV to create a personal link per contact."
                  },
                  {
                    "q": "Can I add my logo?",
                    "a": "Yes, in the editor."
                  },
                  {
                    "q": "Is there a free trial?",
                    "a": "Sample answer: edit this to match your offer."
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
          "id": "pb-pro-contact",
          "eyebrow": "Let's talk",
          "title": "Book a free call",
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
          "id": "pb-pro-footer",
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
          "id": "pb-pro-bar",
          "text": "Start today and see the difference.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
