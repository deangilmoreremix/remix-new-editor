/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-radon-short",
  "name": "Radon mitigation: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-radon-short",
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
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-radon-short",
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
          "id": "pc-radon-short-nav",
          "brand": "PureAir Radon Solutions",
          "logo": "/landing-art/pc-radon-short/logo.webp",
          "links": [
            {
              "label": "Testing",
              "url": ""
            },
            {
              "label": "Mitigation",
              "url": ""
            },
            {
              "label": "Indoor Air",
              "url": ""
            },
            {
              "label": "About",
              "url": ""
            },
            {
              "label": "Reviews",
              "url": ""
            }
          ],
          "loginLabel": "Call Us",
          "loginUrl": "#lead",
          "ctaLabel": "Schedule Consultation"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-radon-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Breathe\nSafer at Home with\n[[Radon Testing & Mitigation]]\nfrom PureAir Radon Solutions",
          "subhead": "Get accurate radon testing, proven mitigation systems, and a healthier home with safer indoor air for the people who matter most — your family.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Schedule a Free Radon Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-radon-short/poster.webp",
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
          "id": "pc-radon-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Accurate Radon Testing",
              "text": "Know your home's radon levels with confidence",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Proven Mitigation Systems",
              "text": "Lower radon to safe, EPA-recommended levels",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Safer Indoor Air",
              "text": "A healthier home environment for lasting peace of mind",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Protect Your Family",
              "text": "Reduce a leading cause of lung cancer in the home",
              "value": "",
              "icon": "users"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-radon-short-form",
          "eyebrow": "",
          "title": "Schedule Your Free Radon Consultation",
          "text": "Get expert advice for testing, mitigation, and a safer home. It's fast, free, and no obligation.",
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
              "label": "Phone",
              "type": "tel",
              "required": false
            },
            {
              "key": "address",
              "label": "Property Address",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Schedule My Free Radon Consultation",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-radon-short-qh",
          "eyebrow": "",
          "title": "Homeowners Trust PureAir Radon Solutions",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-radon-short-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-radon-short-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The testing was quick and easy, and the mitigation system gave us real peace of mind!",
                    "name": "Emily R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-radon-short/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-radon-short-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, knowledgeable, and local. Our radon levels are now well within the safe range!",
                    "name": "Brian T.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-radon-short/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-radon-short-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A healthier home for our family was our top priority. PureAir delivered exactly that.",
                    "name": "Melissa K.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-radon-short/avatar3.webp"
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
          "id": "pc-radon-short-bar",
          "text": "Ready for Safer Indoor Air? Schedule your free radon consultation today and take a simple, proactive step to protect your home and family.",
          "label": "Schedule My Free Radon Consultation",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
