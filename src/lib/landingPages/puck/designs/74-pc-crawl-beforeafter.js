/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-crawl-beforeafter",
  "name": "Crawlspace encapsulation: before/after one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-crawl-beforeafter",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19e8ff",
    "highlight": "#19e8ff",
    "bg": "#06142a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-crawl-beforeafter",
        "accent": "#19e8ff",
        "background": "#06142a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-crawl-beforeafter-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-crawl-beforeafter/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Benefits",
              "url": ""
            },
            {
              "label": "Results",
              "url": ""
            },
            {
              "label": "Reviews",
              "url": ""
            }
          ],
          "loginLabel": "See a Demo",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-crawl-beforeafter-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "Crawlspace Encapsulation",
          "headline": "A Healthier, Drier\nHome [[Starts Below Your Floors]]",
          "subhead": "Seal, protect and improve your home with professional crawlspace encapsulation.",
          "bullets": [],
          "buttons": [
            {
              "label": "Get My Free Crawlspace Quote",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-crawl-beforeafter/poster.webp",
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
          "id": "pc-crawl-beforeafter-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Stop Moisture",
              "text": "",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Improve Air Quality",
              "text": "",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Lower Energy Costs",
              "text": "",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Protect Your Home",
              "text": "",
              "value": "",
              "icon": "shield"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-crawl-beforeafter-form",
          "eyebrow": "",
          "title": "Get Your Free Crawlspace Quote",
          "text": "Tell us a little about your home and we will send a personalized video and a no-obligation estimate.",
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
          "submitLabel": "Get My Free Crawlspace Quote",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-crawl-beforeafter-qh",
          "eyebrow": "",
          "title": "Before and after",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-crawl-beforeafter-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-beforeafter-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our home feels cleaner and the air is fresher.",
                    "name": "Homeowner",
                    "role": "★★★★★",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-beforeafter-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The difference below the floor is amazing.",
                    "name": "Homeowner",
                    "role": "★★★★★",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-beforeafter-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Fast, tidy and professional work.",
                    "name": "Homeowner",
                    "role": "★★★★★",
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
          "id": "pc-crawl-beforeafter-bar",
          "text": "Ready for a healthier home?",
          "label": "Get My Free Assessment",
          "url": "#lead",
          "icon": "calendar"
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pc-crawl-beforeafter-foot",
          "text": "SmartVideo AI • Concept landing-page mockup • Sample imagery and placeholder content",
          "links": []
        }
      }
    ],
    "zones": {}
  }
};
