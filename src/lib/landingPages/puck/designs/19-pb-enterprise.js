/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-enterprise",
  "name": "Enterprise: video at scale",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-enterprise",
  "theme": {
    "mode": "dark",
    "accent": "#2a7bff",
    "highlight": "#2a7bff",
    "bg": "#071a4d",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-enterprise",
        "accent": "#2a7bff",
        "background": "#071a4d",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-enterprise-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-enterprise/logo.webp",
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
          "id": "pb-enterprise-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Enterprise-grade video personalization at scale.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-enterprise/poster.webp",
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
          "submitLabel": "Request a Demo",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-enterprise-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Scale Globally",
              "text": "",
              "value": "",
              "icon": "globe"
            },
            {
              "title": "Integrate Easily",
              "text": "",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Track Results",
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
          "id": "pb-enterprise-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-enterprise-quote",
                "columns": 1,
                "heading": "What Our Enterprise Clients Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps us communicate better with our audience.",
                    "name": "Lisa Chen",
                    "role": "VP Marketing",
                    "avatar": "/landing-art/pb-enterprise/avatar.webp"
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
          "id": "pb-enterprise-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "shorter sales cycle",
              "text": "",
              "value": "40%",
              "icon": ""
            },
            {
              "title": "security ready",
              "text": "",
              "value": "SOC 2",
              "icon": ""
            },
            {
              "title": "uptime",
              "text": "",
              "value": "99.9%",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-enterprise-why",
          "eyebrow": "What you get",
          "title": "Everything your enterprise buyers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-enterprise-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-enterprise-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "shield",
                    "title": "Built for security",
                    "text": "Controls your IT team will approve."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-enterprise-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "users",
                    "title": "Made for teams",
                    "text": "Share templates and track results together."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-enterprise-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "Pipeline insight",
                    "text": "See which accounts engaged."
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
          "id": "pb-enterprise-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-enterprise-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-enterprise-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Create the video",
                    "text": "Record once for the account.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add names, roles and company details.",
                    "icon": ""
                  },
                  {
                    "title": "Track engagement",
                    "text": "See who watched and who clicked.",
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
          "id": "pb-enterprise-say",
          "eyebrow": "What people say",
          "title": "Loved by enterprise buyers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-enterprise-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-enterprise-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "It helped us reach the whole buying group.",
                    "name": "Elena S.",
                    "role": "VP Sales",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-enterprise-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Procurement had no issues.",
                    "name": "Jon P.",
                    "role": "IT director",
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
          "id": "pb-enterprise-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-enterprise-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-enterprise-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Is it secure?",
                    "a": "Sample answer: describe your security practices here."
                  },
                  {
                    "q": "Can we use SSO?",
                    "a": "Sample answer: edit this to match your plan."
                  },
                  {
                    "q": "Can I talk to sales?",
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
          "id": "pb-enterprise-contact",
          "eyebrow": "Let's talk",
          "title": "Talk to sales",
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
          "id": "pb-enterprise-footer",
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
          "id": "pb-enterprise-bar",
          "text": "Ready to transform your video strategy?",
          "label": "Request Demo",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
