/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-tub-short",
  "name": "Bathtub refinishing: one-screen page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-tub-short",
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
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-tub-short",
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
          "id": "pc-tub-short-nav",
          "brand": "FreshCoat Tub Refinishing",
          "logo": "/landing-art/pc-tub-short/logo.webp",
          "links": [
            {
              "label": "Refinishing",
              "url": ""
            },
            {
              "label": "Reglazing",
              "url": ""
            },
            {
              "label": "Chip Repair",
              "url": ""
            },
            {
              "label": "Before & After",
              "url": ""
            },
            {
              "label": "Reviews",
              "url": ""
            }
          ],
          "loginLabel": "Free Estimate",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-tub-short-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "Local Bathtub Refinishing Experts",
          "headline": "Give Your Tub a\nLike-New Look for\n[[Far Less Than Replacement]]",
          "subhead": "FreshCoat Tub Refinishing specializes in professional tub refinishing, reglazing, and chip repair—restoring beauty, durability, and a clean, like-new finish without the cost and hassle of a full renovation.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch How We Restore Tubs",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Free Estimates • Local & Trusted",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-tub-short/poster.webp",
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
          "id": "pc-tub-short-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Like-New Tubs",
              "text": "Restore the look and feel of a new bathtub",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Refinishing & Reglazing",
              "text": "Durable, beautiful finishes that last",
              "value": "",
              "icon": "palette"
            },
            {
              "title": "Chip Repair",
              "text": "Fix chips, scratches, and worn spots",
              "value": "",
              "icon": "gear"
            },
            {
              "title": "Lower-Cost Renovation",
              "text": "A smart, budget-friendly alternative to replacement",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Free Estimates",
              "text": "Get a fast, no-obligation quote today",
              "value": "",
              "icon": "clock"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-tub-short-form",
          "eyebrow": "",
          "title": "Get a Free Estimate for Your Tub Today",
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
              "label": "Phone",
              "type": "tel",
              "required": false
            },
            {
              "key": "city",
              "label": "City / ZIP",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Estimate",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "PageImage",
        "props": {
          "id": "pc-tub-short-ba",
          "src": "/landing-art/pc-tub-short/beforeafter.webp",
          "alt": "A bathtub before and after refinishing",
          "rounded": "yes"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-tub-short-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-tub-short-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our tub looks brand new! The finish is beautiful, the price was great, and the team was professional and quick.",
                    "name": "Melissa T.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-tub-short/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-tub-short-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A huge upgrade for a fraction of the cost of replacement. Highly recommend FreshCoat for tub refinishing and chip repair!",
                    "name": "David R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-tub-short/avatar2.webp"
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
          "id": "pc-tub-short-bar",
          "text": "Ready for a Like-New Tub? Get your free, no-obligation estimate today and see how affordable tub refinishing can be.",
          "label": "Get My Free Estimate Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
