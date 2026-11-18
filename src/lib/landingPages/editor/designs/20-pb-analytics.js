/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pb-analytics",
  "name": "Analytics: track and grow",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-analytics",
  "theme": {
    "mode": "dark",
    "accent": "#5a6cff",
    "highlight": "#5a6cff",
    "bg": "#0b0f4a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pb-analytics",
        "accent": "#5a6cff",
        "background": "#0b0f4a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-analytics-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-analytics/logo.webp",
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
          "id": "pb-analytics-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Track, optimize and grow with personalized video.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-analytics/poster.webp",
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
          "submitLabel": "Get Started",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-analytics-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Track Performance",
              "text": "",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Optimize Results",
              "text": "",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Grow Revenue",
              "text": "",
              "value": "",
              "icon": "rocket"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-analytics-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-analytics-quote",
                "columns": 1,
                "heading": "What Our Users Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI gives me the insights we need to grow.",
                    "name": "Emily Carter",
                    "role": "Growth Strategist",
                    "avatar": "/landing-art/pb-analytics/avatar.webp"
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
          "id": "pb-analytics-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "views tracked",
              "text": "",
              "value": "128k",
              "icon": ""
            },
            {
              "title": "average watch time",
              "text": "",
              "value": "72%",
              "icon": ""
            },
            {
              "title": "click-through",
              "text": "",
              "value": "18%",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-analytics-why",
          "eyebrow": "What you get",
          "title": "Everything your your viewers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-analytics-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-analytics-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "Watch-time insight",
                    "text": "See where viewers stay or leave."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-analytics-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "target",
                    "title": "Click tracking",
                    "text": "Know who clicked your call to action."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-analytics-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "users",
                    "title": "Per-contact reports",
                    "text": "See who watched, by name."
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
          "id": "pb-analytics-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-analytics-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-analytics-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Publish your page",
                    "text": "Share one link or one per contact.",
                    "icon": ""
                  },
                  {
                    "title": "Collect activity",
                    "text": "Plays, progress and clicks are recorded.",
                    "icon": ""
                  },
                  {
                    "title": "Act on it",
                    "text": "Follow up with the people who watched.",
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
          "id": "pb-analytics-say",
          "eyebrow": "What people say",
          "title": "Loved by your viewers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-analytics-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-analytics-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Now we know exactly who to call.",
                    "name": "Ben A.",
                    "role": "Sales ops",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-analytics-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The reports replaced three tools.",
                    "name": "Carla N.",
                    "role": "Marketing lead",
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
          "id": "pb-analytics-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-analytics-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-analytics-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "What is tracked?",
                    "a": "Views, plays, progress, clicks and leads."
                  },
                  {
                    "q": "Can I export it?",
                    "a": "Sample answer: edit this to match your plan."
                  },
                  {
                    "q": "Is it private?",
                    "a": "Only you can see the stats for your pages."
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
          "id": "pb-analytics-contact",
          "eyebrow": "Let's talk",
          "title": "See your results",
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
          "id": "pb-analytics-footer",
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
          "id": "pb-analytics-bar",
          "text": "Turn more viewers into loyal customers.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
