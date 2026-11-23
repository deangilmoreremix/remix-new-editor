/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pb-agent",
  "name": "Agent: personal messages",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-agent",
  "theme": {
    "mode": "dark",
    "accent": "#7cc8ff",
    "highlight": "#7cc8ff",
    "bg": "#06122b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pb-agent",
        "accent": "#7cc8ff",
        "background": "#06122b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-agent-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-agent/logo.webp",
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
          "id": "pb-agent-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Turn one video into personalized messages for every prospect.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-agent/poster.webp",
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
          "id": "pb-agent-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalize at Scale",
              "text": "",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Build Your List",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Grow Your Business",
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
          "id": "pb-agent-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agent-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps me connect with more clients and close more deals.",
                    "name": "Michael Reeves",
                    "role": "Real Estate Agent",
                    "avatar": "/landing-art/pb-agent/avatar.webp"
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
          "id": "pb-agent-stats",
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
          "id": "pb-agent-why",
          "eyebrow": "What you get",
          "title": "Everything your buyers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agent-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-agent-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "home",
                    "title": "Property showcases",
                    "text": "Walk each lead through the homes that fit them."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-agent-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "pin",
                    "title": "Local area videos",
                    "text": "Show the neighborhood, schools and amenities."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-agent-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "See who is watching",
                    "text": "Know which leads are ready for a call."
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
          "id": "pb-agent-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agent-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-agent-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Record once",
                    "text": "Film a short walkthrough or intro.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add the name, address and message per lead.",
                    "icon": ""
                  },
                  {
                    "title": "Send and follow up",
                    "text": "Share the link and see who watched.",
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
          "id": "pb-agent-say",
          "eyebrow": "What people say",
          "title": "Loved by buyers and sellers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agent-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agent-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The video got me three showings in one weekend.",
                    "name": "Michael R.",
                    "role": "Agent, Austin",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agent-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Clients tell me it feels like a one-to-one call.",
                    "name": "Dana P.",
                    "role": "Broker, Denver",
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
          "id": "pb-agent-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agent-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-agent-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Do I need to film each video?",
                    "a": "No. Record one video and personalize the name and details for each lead."
                  },
                  {
                    "q": "Can I use it on listings?",
                    "a": "Yes. Add a page per listing and share the link anywhere."
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
          "id": "pb-agent-contact",
          "eyebrow": "Let's talk",
          "title": "Get your free listing video",
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
          "id": "pb-agent-footer",
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
          "id": "pb-agent-bar",
          "text": "Ready to grow your business?",
          "label": "Get Started Free",
          "url": "#lead",
          "icon": "home"
        }
      }
    ],
    "zones": {}
  }
};
