/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pd-grease-long",
  "name": "Grease-trap service: full landing page",
  "description": "Full landing page: video hero, benefit strip, lead form band, the four-step experience, a \"showcase\" section, services, three testimonials and a closing bar. Names, quotes and offers are sample content.",
  "designClass": "pd-grease-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ffb21f",
    "highlight": "#ffb21f",
    "bg": "#070d1f",
    "text": "#e8efff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 16,
  "editorData": {
    "root": {
      "props": {
        "design": "pd-grease-long",
        "accent": "#ffb21f",
        "background": "#070d1f",
        "text": "#e8efff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-grease-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-grease-long/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Features",
              "url": ""
            },
            {
              "label": "Results",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            }
          ],
          "loginLabel": "Book a Demo",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pd-grease-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "Book More Commercial\nGrease-Trap Service\n[[Accounts]]",
          "subhead": "Personalized video outreach, follow-ups and service reminders that help restaurants and commercial kitchens say yes to your grease trap cleaning services.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Local Consultation",
              "url": "#contact",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pd-grease-long/poster.webp",
          "showForm": "no",
          "slotImage": "",
          "slotVideo": "",
          "bakedPlay": "yes",
          "formTitle": "",
          "formSubtitle": "",
          "formFields": [],
          "submitLabel": "",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-grease-long-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Win more recurring accounts",
              "text": "Professional guidance",
              "value": "",
              "icon": "chart",
              "image": ""
            },
            {
              "title": "Reduce no-shows with reminders",
              "text": "Easy scheduling",
              "value": "",
              "icon": "calendar",
              "image": ""
            },
            {
              "title": "Build long-term restaurant relationships",
              "text": "Confidence and clarity",
              "value": "",
              "icon": "users",
              "image": ""
            },
            {
              "title": "Support compliance",
              "text": "Save time with video",
              "value": "",
              "icon": "shield",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pd-grease-long-form",
          "eyebrow": "",
          "title": "Get a Free Demo & Strategy for More Service Accounts",
          "text": "Enter your information below to request a personalized video, free resources, and a local service quote.",
          "fields": [
            {
              "key": "name",
              "label": "First Name",
              "type": "text",
              "required": true
            },
            {
              "key": "email",
              "label": "Email Address",
              "type": "email",
              "required": true
            },
            {
              "key": "phone",
              "label": "Phone (Optional)",
              "type": "tel",
              "required": false
            }
          ],
          "submitLabel": "Request My Free Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-grease-long-exp",
          "eyebrow": "THE PERSONALIZED EXPERIENCE",
          "title": "From your first video to a confident next step.",
          "text": "A simple, visual way to learn what Commercial Grease-Trap Service can do for you.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-grease-long-steps-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pd-grease-long-steps",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "01  Watch your video",
                    "text": "See a personal introduction, services, and results tailored to your interests.",
                    "icon": "video"
                  },
                  {
                    "title": "02  Choose what matters",
                    "text": "Explore options, answer a few questions, and get useful recommendations.",
                    "icon": "filter"
                  },
                  {
                    "title": "03  Request a plan",
                    "text": "Tell the local team what you need and receive clear next steps.",
                    "icon": "send"
                  },
                  {
                    "title": "04  Get scheduled",
                    "text": "Pick a convenient time and move forward with confidence.",
                    "icon": "calendar"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-grease-long-showcase",
          "variant": "split",
          "side": "right",
          "title": "Showcase the details that make your business stand out.",
          "text": "A simple, powerful way to attract, convert, and retain more commercial kitchen and restaurant clients.",
          "bullets": [],
          "buttonLabel": "Explore My Options",
          "buttonUrl": "#contact",
          "image": "/landing-art/pd-grease-long/laptop.webp",
          "imageAlt": "A personalized video page preview",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-grease-long-svc",
          "eyebrow": "SOLUTIONS THAT FIT",
          "title": "Explore our specialized services",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-grease-long-services",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized outreach videos",
              "text": "Expert local service",
              "value": "",
              "icon": "video",
              "image": ""
            },
            {
              "title": "Decision-maker reach",
              "text": "Clear next steps",
              "value": "",
              "icon": "send",
              "image": ""
            },
            {
              "title": "Recurring cleaning bookings",
              "text": "Fast turnaround",
              "value": "",
              "icon": "calendar",
              "image": ""
            },
            {
              "title": "Compliance reminders",
              "text": "Made for your needs",
              "value": "",
              "icon": "shield",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-grease-long-rel",
          "eyebrow": "A BETTER WAY TO CONNECT",
          "title": "Built around local relationships",
          "text": "Illustrative reviews shown as design placeholders; replace with verified customer testimonials before publishing.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-grease-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-grease-long-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The video explained everything clearly and made it easy to decide what to do next.",
                    "name": "Local customer example",
                    "role": "Local customer",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-grease-long-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I appreciated seeing the options before getting in touch. The process felt personal.",
                    "name": "Illustrative testimonial",
                    "role": "Local customer",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-grease-long-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "It was simple to get details, ask questions, and schedule a convenient time.",
                    "name": "Illustrative testimonial",
                    "role": "Local customer",
                    "avatar": ""
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pd-grease-long-cta",
          "text": "Ready to get started? Watch your personalized introduction and connect with a local specialist.",
          "label": "Request My Free Demo",
          "url": "#contact",
          "icon": "calendar",
          "icons": []
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pd-grease-long-footer",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
