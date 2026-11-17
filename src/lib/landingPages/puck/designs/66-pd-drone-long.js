/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pd-drone-long",
  "name": "Drone property inspection: full landing page",
  "description": "Full landing page: video hero, benefit strip, lead form band, the four-step experience, a \"showcase\" section, services, three testimonials and a closing bar. Names, quotes and offers are sample content.",
  "designClass": "pd-drone-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19e8ff",
    "highlight": "#19e8ff",
    "bg": "#070d1f",
    "text": "#e8efff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 16,
  "puckData": {
    "root": {
      "props": {
        "design": "pd-drone-long",
        "accent": "#19e8ff",
        "background": "#070d1f",
        "text": "#e8efff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-drone-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-drone-long/logo.webp",
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
          "id": "pd-drone-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "See Every Detail.\nMake Smarter Property\nDecisions. [[Drone Property Inspections]]",
          "subhead": "Personalized aerial property videos, roof assessments and clear inspection reports delivered without the guesswork.",
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
          "photo": "/landing-art/pd-drone-long/poster.webp",
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
          "id": "pd-drone-long-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "High-resolution aerial video",
              "text": "Professional guidance",
              "value": "",
              "icon": "check",
              "image": ""
            },
            {
              "title": "Hard-to-reach areas viewed safely",
              "text": "Easy scheduling",
              "value": "",
              "icon": "target",
              "image": ""
            },
            {
              "title": "Clear shareable inspection reports",
              "text": "Confidence and clarity",
              "value": "",
              "icon": "camera",
              "image": ""
            },
            {
              "title": "Fast scheduling and delivery",
              "text": "Save time with video",
              "value": "",
              "icon": "clock",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pd-drone-long-form",
          "eyebrow": "",
          "title": "Get Your Personalized Property Inspection Video",
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
          "submitLabel": "Get My Free Aerial Assessment",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-drone-long-exp",
          "eyebrow": "THE PERSONALIZED EXPERIENCE",
          "title": "From your first video to a confident next step.",
          "text": "A simple, visual way to learn what SkyScan Property Imaging can do for you.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-drone-long-steps-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pd-drone-long-steps",
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
          "id": "pd-drone-long-showcase",
          "variant": "split",
          "side": "right",
          "title": "Showcase the details that make your business stand out.",
          "text": "Personalized aerial property videos, roof assessments and clear inspection reports delivered without the guesswork.",
          "bullets": [],
          "buttonLabel": "Explore My Options",
          "buttonUrl": "#contact",
          "image": "/landing-art/pd-drone-long/laptop.webp",
          "imageAlt": "A personalized video page preview",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-drone-long-svc",
          "eyebrow": "SOLUTIONS THAT FIT",
          "title": "Explore our specialized services",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-drone-long-services",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Aerial Roof Surveys",
              "text": "Expert local service",
              "value": "",
              "icon": "sparkles",
              "image": ""
            },
            {
              "title": "Thermal Imaging",
              "text": "Clear next steps",
              "value": "",
              "icon": "target",
              "image": ""
            },
            {
              "title": "Property Documentation",
              "text": "Fast turnaround",
              "value": "",
              "icon": "layers",
              "image": ""
            },
            {
              "title": "Construction Progress",
              "text": "Made for your needs",
              "value": "",
              "icon": "chart",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-drone-long-rel",
          "eyebrow": "A BETTER WAY TO CONNECT",
          "title": "Built around local relationships",
          "text": "Illustrative reviews shown as design placeholders; replace with verified customer testimonials before publishing.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-drone-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-drone-long-quote1",
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
                "id": "pd-drone-long-quote2",
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
                "id": "pd-drone-long-quote3",
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
          "id": "pd-drone-long-cta",
          "text": "Ready to get started? Watch your personalized introduction and connect with a local specialist.",
          "label": "Get My Free Aerial Assessment",
          "url": "#contact",
          "icon": "calendar",
          "icons": []
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pd-drone-long-footer",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
