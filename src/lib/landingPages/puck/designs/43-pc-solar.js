/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-solar",
  "name": "Solar: lower energy bills",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-solar",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ffc83a",
    "highlight": "#ffc83a",
    "bg": "#07153a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-solar",
        "accent": "#ffc83a",
        "background": "#07153a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-solar-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-solar/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Solutions",
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
          "id": "pc-solar-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "Lower Your Energy Bills\nwith [[Clean, Reliable Solar]]",
          "subhead": "Hi {{firstname|there}}, I put together a quick, personalized video to show how solar can cut your energy costs, power your home with clean energy, and what it would look like for your home.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Solar Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-solar/poster.webp",
          "showForm": "no",
          "formTitle": "",
          "formSubtitle": "",
          "formFields": [],
          "submitLabel": "",
          "privacy": "",
          "slotImage": "",
          "slotVideo": "",
          "bakedPlay": "yes"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pc-solar-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Real Solar Savings",
              "text": "Lower your electric bill and keep more money.",
              "value": "",
              "icon": "bolt"
            },
            {
              "title": "Home Energy Analysis",
              "text": "Get a custom solar plan for your home's energy needs.",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Flexible Financing",
              "text": "Affordable options, including low monthly payments.",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Trusted Local Installation",
              "text": "Installed by a local, licensed, 5-star team you can count on.",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-solar-form",
          "eyebrow": "",
          "title": "Get Your Free Solar Plan",
          "text": "Enter your information below to get a personalized solar demo, savings estimate, and next steps for your home.",
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
            },
            {
              "key": "bill",
              "label": "Average Electric Bill (e.g., $150/month)",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Solar Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-solar-qh",
          "eyebrow": "",
          "title": "See What Homeowners Say",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-solar-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-solar-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our electric bill is down 68%! The local team made it so easy.",
                    "name": "Melissa R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-solar/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-solar-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, honest, and local. We're glad we went solar!",
                    "name": "David K.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-solar/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-solar-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Clean energy, real savings, and great service from start to finish.",
                    "name": "Linda M.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-solar/avatar3.webp"
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
          "id": "pc-solar-bar",
          "text": "Ready to Save with Solar? Watch your personalized video, get your free solar plan, and book your consultation today.",
          "label": "Book My Solar Consultation Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
