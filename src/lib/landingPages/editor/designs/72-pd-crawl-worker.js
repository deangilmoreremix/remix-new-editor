/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pd-crawl-worker",
  "name": "Crawlspace encapsulation: worker full page",
  "description": "Full landing page: video hero, benefit strip, lead form band, the four-step experience, a \"showcase\" section, services, three testimonials and a closing bar. Names, quotes and offers are sample content.",
  "designClass": "pd-crawl-worker",
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
        "design": "pd-crawl-worker",
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
          "id": "pd-crawl-worker-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-crawl-worker/logo.webp",
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
          "id": "pd-crawl-worker-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "A Cleaner, Healthier\nHome Starts\n[[Underneath]]",
          "subhead": "Seal out moisture, stop mold, and protect your home with professional crawlspace encapsulation.",
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
          "photo": "/landing-art/pd-crawl-worker/poster.webp",
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
          "id": "pd-crawl-worker-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Lower Energy Bills",
              "text": "Seal and insulate",
              "value": "",
              "icon": "home",
              "image": ""
            },
            {
              "title": "Healthier Indoor Air",
              "text": "Fewer allergens",
              "value": "",
              "icon": "leaf",
              "image": ""
            },
            {
              "title": "Protect Your Home's Value",
              "text": "Stop moisture damage",
              "value": "",
              "icon": "shield",
              "image": ""
            },
            {
              "title": "Long-Lasting Results",
              "text": "Built to last",
              "value": "",
              "icon": "calendar",
              "image": ""
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pd-crawl-worker-form",
          "eyebrow": "",
          "title": "Get Your Free Crawlspace Assessment",
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
          "submitLabel": "Get My Free Assessment",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-crawl-worker-exp",
          "eyebrow": "THE PERSONALIZED EXPERIENCE",
          "title": "From your first video to a confident next step.",
          "text": "A simple, visual way to learn what SmartVideo AI Crawlspace can do for you.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-crawl-worker-steps-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pd-crawl-worker-steps",
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
          "id": "pd-crawl-worker-showcase",
          "variant": "split",
          "side": "right",
          "title": "Showcase the details that make your business stand out.",
          "text": "A sealed, insulated crawlspace keeps moisture out, stops mold growth, and creates a cleaner, healthier home for your family.",
          "bullets": [],
          "buttonLabel": "Get My Free Assessment",
          "buttonUrl": "#contact",
          "image": "/landing-art/pd-crawl-worker/laptop.webp",
          "imageAlt": "A personalized video page preview",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-crawl-worker-svc",
          "eyebrow": "SOLUTIONS THAT FIT",
          "title": "Explore our specialized services",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-crawl-worker-services",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Professional Installation",
              "text": "Expert local service",
              "value": "",
              "icon": "check",
              "image": ""
            },
            {
              "title": "High-Quality Materials",
              "text": "Clear next steps",
              "value": "",
              "icon": "layers",
              "image": ""
            },
            {
              "title": "Local, Trusted Experts",
              "text": "Fast turnaround",
              "value": "",
              "icon": "users",
              "image": ""
            },
            {
              "title": "Moisture Protection",
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
          "id": "pd-crawl-worker-rel",
          "eyebrow": "A BETTER WAY TO CONNECT",
          "title": "Built around local relationships",
          "text": "Illustrative reviews shown as design placeholders; replace with verified customer testimonials before publishing.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-crawl-worker-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-crawl-worker-quote1",
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
                "id": "pd-crawl-worker-quote2",
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
                "id": "pd-crawl-worker-quote3",
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
          "id": "pd-crawl-worker-cta",
          "text": "Ready to get started? Watch your personalized introduction and connect with a local specialist.",
          "label": "Get My Free Assessment",
          "url": "#contact",
          "icon": "calendar",
          "icons": []
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pd-crawl-worker-footer",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
