/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-creative",
  "name": "Creative studio",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pa-creative",
  "theme": {
    "mode": "dark",
    "accent": "#4a3df0",
    "highlight": "#4a3df0",
    "bg": "#1a0f3a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-creative",
        "accent": "#4a3df0",
        "background": "#1a0f3a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-creative-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-creative/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-creative-hero",
          "variant": "story",
          "background": "/landing-art/pa-creative/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Alex}},\nBring Your Ideas to Life",
          "subhead": "Get a personalized video about our creative services.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-creative/poster.webp",
          "showForm": "yes",
          "formTitle": "Start a Project",
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
          "submitLabel": "Let's Create",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-creative-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Creative Solutions",
              "text": "",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Design & Video",
              "text": "",
              "value": "",
              "icon": "palette"
            },
            {
              "title": "Grow Your Brand",
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
          "id": "pa-creative-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-creative-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI turned our ideas into stunning videos.",
                    "name": "Daniel K.",
                    "role": "",
                    "avatar": "/landing-art/pa-creative/avatar.webp"
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
          "id": "pa-creative-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "projects shipped",
              "text": "",
              "value": "150+",
              "icon": ""
            },
            {
              "title": "client rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            },
            {
              "title": "faster approvals",
              "text": "",
              "value": "5x",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-creative-why",
          "eyebrow": "What you get",
          "title": "Everything your clients needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-creative-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-creative-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "sparkles",
                    "title": "Creative solutions",
                    "text": "Ideas that make people stop and look."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-creative-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "palette",
                    "title": "Design and video",
                    "text": "Brand, motion and story together."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-creative-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "rocket",
                    "title": "Grow your brand",
                    "text": "Work that moves your numbers."
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
          "id": "pa-creative-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-creative-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-creative-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "See how we think.",
                    "icon": ""
                  },
                  {
                    "title": "Share your brief",
                    "text": "Tell us your goals.",
                    "icon": ""
                  },
                  {
                    "title": "Launch the project",
                    "text": "We deliver on time.",
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
          "id": "pa-creative-say",
          "eyebrow": "What people say",
          "title": "Loved by clients",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-creative-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-creative-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "They turned our ideas into stunning videos.",
                    "name": "Daniel K.",
                    "role": "Founder",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-creative-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The team understood us immediately.",
                    "name": "Mia F.",
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
          "id": "pa-creative-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-creative-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-creative-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "How long does a project take?",
                    "a": "Sample answer: edit this with your timelines."
                  },
                  {
                    "q": "Do you work with startups?",
                    "a": "Sample answer: edit this to match your offer."
                  },
                  {
                    "q": "Can I see your work?",
                    "a": "Yes. Ask in the form below."
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
          "id": "pa-creative-contact",
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
          "id": "pa-creative-footer",
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
          "id": "pa-creative-bar",
          "text": "",
          "label": "Get in Touch",
          "url": "#lead",
          "icon": "mail"
        }
      }
    ],
    "zones": {}
  }
};
