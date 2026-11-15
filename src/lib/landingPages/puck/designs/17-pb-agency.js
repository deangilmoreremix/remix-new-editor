/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-agency",
  "name": "Agency: video marketing",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-agency",
  "theme": {
    "mode": "dark",
    "accent": "#6d4aff",
    "highlight": "#6d4aff",
    "bg": "#0b1030",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-agency",
        "accent": "#6d4aff",
        "background": "#0b1030",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-agency-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-agency/logo.webp",
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
          "id": "pb-agency-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Powerful video marketing for agencies and businesses.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-agency/poster.webp",
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
          "submitLabel": "Request Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-agency-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Scale Outreach",
              "text": "",
              "value": "",
              "icon": "rocket"
            },
            {
              "title": "Drive Engagement",
              "text": "",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Grow Revenue",
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
          "id": "pb-agency-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agency-quote",
                "columns": 1,
                "heading": "What Our Clients Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI is a game changer for our agency.",
                    "name": "Sarah Bennett",
                    "role": "Marketing Agency",
                    "avatar": "/landing-art/pb-agency/avatar.webp"
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
          "id": "pb-agency-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "faster approvals",
              "text": "",
              "value": "5x",
              "icon": ""
            },
            {
              "title": "campaigns shipped",
              "text": "",
              "value": "120+",
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
          "id": "pb-agency-why",
          "eyebrow": "What you get",
          "title": "Everything your clients needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agency-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-agency-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "palette",
                    "title": "Creative pitches",
                    "text": "Present ideas in a video made for each client."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-agency-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "target",
                    "title": "Clear next steps",
                    "text": "Every page ends with a call to action."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-agency-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "Proof of results",
                    "text": "Share numbers that matter to them."
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
          "id": "pb-agency-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agency-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-agency-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Record the pitch",
                    "text": "Walk through the idea on video.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add the client name and brand.",
                    "icon": ""
                  },
                  {
                    "title": "Win the work",
                    "text": "They respond on the page.",
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
          "id": "pb-agency-say",
          "eyebrow": "What people say",
          "title": "Loved by clients and brands",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agency-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agency-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Pitches land better with a face and a name.",
                    "name": "Lena V.",
                    "role": "Creative director",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-agency-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Clients forward our pages internally.",
                    "name": "Marc F.",
                    "role": "Founder, Studio North",
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
          "id": "pb-agency-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-agency-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-agency-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can I use my brand colors?",
                    "a": "Yes, in the editor."
                  },
                  {
                    "q": "Can I add case studies?",
                    "a": "Yes. Add sections or links."
                  },
                  {
                    "q": "Is it free to try?",
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
          "id": "pb-agency-contact",
          "eyebrow": "Let's talk",
          "title": "Start a project",
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
          "id": "pb-agency-footer",
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
          "id": "pb-agency-bar",
          "text": "Take your video marketing to the next level.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
