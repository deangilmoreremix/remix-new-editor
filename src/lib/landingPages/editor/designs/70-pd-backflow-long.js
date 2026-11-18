/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pd-backflow-long",
  "name": "Backflow testing: full landing page",
  "description": "Full landing page: video hero, benefit strip, lead form band, the four-step experience, a \"showcase\" section, services, three testimonials and a closing bar. Names, quotes and offers are sample content.",
  "designClass": "pd-backflow-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ff4a4a",
    "highlight": "#ff4a4a",
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
        "design": "pd-backflow-long",
        "accent": "#ff4a4a",
        "background": "#070d1f",
        "text": "#e8efff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-backflow-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-backflow-long/logo.webp",
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
          "id": "pd-backflow-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "Win More\n[[Backflow Preventer Compliance]]\n& Maintenance Jobs",
          "subhead": "Use personalized video outreach to educate property owners, facility managers and businesses, drive testing appointments and keep their water systems compliant.",
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
          "photo": "/landing-art/pd-backflow-long/poster.webp",
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
          "id": "pd-backflow-long-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Generate more testing appointments",
              "text": "Professional guidance",
              "value": "",
              "icon": "calendar",
              "image": ""
            },
            {
              "title": "Target the right accounts",
              "text": "Easy scheduling",
              "value": "",
              "icon": "users",
              "image": ""
            },
            {
              "title": "Keep clients on a maintenance schedule",
              "text": "Confidence and clarity",
              "value": "",
              "icon": "check",
              "image": ""
            },
            {
              "title": "Drive compliance and reduce risk",
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
          "id": "pd-backflow-long-form",
          "eyebrow": "",
          "title": "Get a Personalized Demo",
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
          "submitLabel": "Book My Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-backflow-long-exp",
          "eyebrow": "THE PERSONALIZED EXPERIENCE",
          "title": "From your first video to a confident next step.",
          "text": "A simple, visual way to learn what Backflow Testing Services can do for you.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-backflow-long-steps-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pd-backflow-long-steps",
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
          "id": "pd-backflow-long-showcase",
          "variant": "split",
          "side": "right",
          "title": "Showcase the details that make your business stand out.",
          "text": "Personalized videos that speak directly to the property, the contact and the testing needs, at scale.",
          "bullets": [],
          "buttonLabel": "Explore My Options",
          "buttonUrl": "#contact",
          "image": "/landing-art/pd-backflow-long/laptop.webp",
          "imageAlt": "A personalized video page preview",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-backflow-long-svc",
          "eyebrow": "SOLUTIONS THAT FIT",
          "title": "Explore our specialized services",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-backflow-long-services",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized at scale",
              "text": "Expert local service",
              "value": "",
              "icon": "video",
              "image": ""
            },
            {
              "title": "Commercial and multi-site",
              "text": "Clear next steps",
              "value": "",
              "icon": "building",
              "image": ""
            },
            {
              "title": "Automated outreach",
              "text": "Fast turnaround",
              "value": "",
              "icon": "send",
              "image": ""
            },
            {
              "title": "Compliance and safety",
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
          "id": "pd-backflow-long-rel",
          "eyebrow": "A BETTER WAY TO CONNECT",
          "title": "Built around local relationships",
          "text": "Illustrative reviews shown as design placeholders; replace with verified customer testimonials before publishing.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-backflow-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-backflow-long-quote1",
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
                "id": "pd-backflow-long-quote2",
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
                "id": "pd-backflow-long-quote3",
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
          "id": "pd-backflow-long-cta",
          "text": "Ready to get started? Watch your personalized introduction and connect with a local specialist.",
          "label": "Book My Demo",
          "url": "#contact",
          "icon": "calendar",
          "icons": []
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pd-backflow-long-footer",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
