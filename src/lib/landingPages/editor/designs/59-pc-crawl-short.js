/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-crawl-short",
  "name": "Crawl space encapsulation: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-crawl-short",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#8cff1f",
    "highlight": "#8cff1f",
    "bg": "#04120f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-crawl-short",
        "accent": "#8cff1f",
        "background": "#04120f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-crawl-short-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-crawl-short/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Encapsulation",
              "url": ""
            },
            {
              "label": "Moisture Control",
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
          "loginLabel": "Book a Free Assessment",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-crawl-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Protect\nYour Home from Moisture\nwith [[Crawl Space Encapsulation]]\nby DryHome Crawlspace.",
          "subhead": "A clean, dry crawl space means better moisture control, mold prevention, lower humidity, and healthier air for your whole home.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Get a Free Assessment Today",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-crawl-short/poster.webp",
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
          "id": "pc-crawl-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Moisture Control",
              "text": "Stop dampness at the source",
              "value": "",
              "icon": "filter"
            },
            {
              "title": "Mold Prevention",
              "text": "Create a cleaner, healthier space",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Encapsulation",
              "text": "Seal and protect your crawl space",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Lower Humidity",
              "text": "Keep your home drier and more comfortable",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Healthier Air",
              "text": "Reduce mold spores and allergens",
              "value": "",
              "icon": "heart"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-crawl-short-form",
          "eyebrow": "",
          "title": "Get a Free Crawl Space Assessment",
          "text": "",
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
              "label": "Phone Number",
              "type": "tel",
              "required": false
            },
            {
              "key": "zip",
              "label": "ZIP Code",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Crawl Space Assessment",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-crawl-short-process-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pc-crawl-short-process",
                "columns": 1,
                "title": "Our Simple Process",
                "layout": "row",
                "items": [
                  {
                    "title": "Free Assessment",
                    "text": "Inspect, test moisture & identify issues",
                    "icon": "check"
                  },
                  {
                    "title": "Encapsulate & Seal",
                    "text": "Install a durable vapor barrier & moisture control",
                    "icon": "layers"
                  },
                  {
                    "title": "Enjoy a Healthier Home",
                    "text": "Lower humidity, cleaner air & long-term protection",
                    "icon": "heart"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-crawl-short-quotes",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-short-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "DryHome encapsulated our crawl space, knocked down the humidity, and completely eliminated the musty smell!",
                    "name": "Amanda L.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-crawl-short/avatar1.webp"
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
          "id": "pc-crawl-short-bar",
          "text": "A Drier, Healthier Home Starts Below. Get your free crawl space assessment today and take control of moisture, mold, and indoor air.",
          "label": "Get My Free Crawl Space Assessment",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
