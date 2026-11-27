/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pd-septic-pumping",
  "name": "Septic pumping: full landing page",
  "description": "Full landing page: video hero, benefit strip, lead form band, the four-step experience, a \"showcase\" section, services, three testimonials and a closing bar. Names, quotes and offers are sample content.",
  "designClass": "pd-septic-pumping",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#8cff1f",
    "highlight": "#8cff1f",
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
        "design": "pd-septic-pumping",
        "accent": "#8cff1f",
        "background": "#070d1f",
        "text": "#e8efff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-septic-pumping-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-septic-pumping/logo.webp",
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
          "id": "pd-septic-pumping-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "Keep Your Septic System\n[[Healthy & Problem-Free]]",
          "subhead": "Professional septic pumping, cleaning and maintenance to prevent costly repairs and keep your home or business running smoothly.",
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
          "photo": "/landing-art/pd-septic-pumping/poster.webp",
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
          "id": "pd-septic-pumping-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Fast Scheduling",
              "text": "Get a service time that works for you",
              "value": "",
              "icon": "calendar",
              "image": ""
            },
            {
              "title": "Licensed & Insured",
              "text": "Professional, safe and compliant service",
              "value": "",
              "icon": "shield",
              "image": ""
            },
            {
              "title": "Reliable Service",
              "text": "On time, every time with no surprises",
              "value": "",
              "icon": "clock",
              "image": ""
            },
            {
              "title": "Local & Trusted",
              "text": "Serving homeowners and businesses near you",
              "value": "",
              "icon": "star",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pd-septic-pumping-form",
          "eyebrow": "",
          "title": "Get Your Free Service Quote Today!",
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
          "submitLabel": "Get My Free Quote",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-septic-pumping-exp",
          "eyebrow": "THE PERSONALIZED EXPERIENCE",
          "title": "From your first video to a confident next step.",
          "text": "A simple, visual way to learn what ClearFlow Septic Pumping can do for you.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-septic-pumping-steps-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pd-septic-pumping-steps",
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
          "id": "pd-septic-pumping-showcase",
          "variant": "split",
          "side": "right",
          "title": "Showcase the details that make your business stand out.",
          "text": "Septic pumping, cleaning, inspections and maintenance plans from a local team you can trust.",
          "bullets": [],
          "buttonLabel": "Get My Free Quote",
          "buttonUrl": "#contact",
          "image": "/landing-art/pd-septic-pumping/laptop.webp",
          "imageAlt": "A personalized video page preview",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-septic-pumping-svc",
          "eyebrow": "SOLUTIONS THAT FIT",
          "title": "Explore our specialized services",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-septic-pumping-services",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Septic Pumping",
              "text": "Expert local service",
              "value": "",
              "icon": "car",
              "image": ""
            },
            {
              "title": "Septic Cleaning",
              "text": "Clear next steps",
              "value": "",
              "icon": "sparkles",
              "image": ""
            },
            {
              "title": "System Inspections",
              "text": "Fast turnaround",
              "value": "",
              "icon": "target",
              "image": ""
            },
            {
              "title": "Maintenance Plans",
              "text": "Made for your needs",
              "value": "",
              "icon": "calendar",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-septic-pumping-rel",
          "eyebrow": "A BETTER WAY TO CONNECT",
          "title": "Built around local relationships",
          "text": "Illustrative reviews shown as design placeholders; replace with verified customer testimonials before publishing.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-septic-pumping-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-septic-pumping-quote1",
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
                "id": "pd-septic-pumping-quote2",
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
                "id": "pd-septic-pumping-quote3",
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
          "id": "pd-septic-pumping-cta",
          "text": "Ready to get started? Watch your personalized introduction and connect with a local specialist.",
          "label": "Get My Free Quote",
          "url": "#contact",
          "icon": "calendar",
          "icons": []
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pd-septic-pumping-footer",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
