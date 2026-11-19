/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-crawl-long",
  "name": "Crawl space encapsulation: full landing page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-crawl-long",
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
        "design": "pc-crawl-long",
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
          "id": "pc-crawl-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-crawl-long/logo.webp",
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
            },
            {
              "label": "For Local Businesses",
              "url": ""
            },
            {
              "label": "Resources",
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
          "id": "pc-crawl-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Protect Your\nHome from Moisture, Mold,\nand Costly Damage with\n[[Crawl Space Encapsulation.]]",
          "subhead": "Get a quick, personalized video showing how DryHome Crawlspace can eliminate moisture, prevent mold, lower humidity, and create a clean, healthier home for you and your family.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Free Crawl Space Inspection",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-crawl-long/poster.webp",
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
          "id": "pc-crawl-long-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Encapsulation Experts",
              "text": "Seal out ground moisture with a durable vapor barrier",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Mold Prevention",
              "text": "Stop mold at the source and protect your home's air quality",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Lower Humidity",
              "text": "Keep humidity in check (ideally 45–55%)",
              "value": "",
              "icon": "filter"
            },
            {
              "title": "Healthier Home",
              "text": "Cleaner air, fewer allergens, and a more comfortable home",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Long-Term Value",
              "text": "Prevent structural damage, reduce repair costs, and boost home value",
              "value": "",
              "icon": "tag"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-crawl-long-form",
          "eyebrow": "",
          "title": "Get a Free, Personalized Crawl Space Assessment",
          "text": "Enter your information below to get your personalized video, a free home crawl space assessment, and a no-obligation estimate.",
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
              "key": "zip",
              "label": "ZIP Code",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Assessment",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pc-crawl-long-difference",
          "variant": "split",
          "side": "left",
          "title": "The [[DryHome Crawlspace]] Difference",
          "text": "A properly encapsulated crawl space does more than keep water out — it creates a cleaner, drier, and healthier home from the ground up.",
          "bullets": [
            {
              "text": "Professional crawl space encapsulation"
            },
            {
              "text": "Moisture and water intrusion control"
            },
            {
              "text": "Mold and mildew prevention"
            },
            {
              "text": "Humidity reduction and air quality improvement"
            },
            {
              "text": "Long-lasting, durable vapor barrier systems"
            },
            {
              "text": "Local, trusted team with proven results"
            }
          ],
          "buttonLabel": "",
          "buttonUrl": "#video",
          "image": "/landing-art/pc-crawl-long/diff.webp",
          "imageAlt": "A clean, dry, encapsulated crawl space",
          "background": "",
          "points": []
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-crawl-long-process-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pc-crawl-long-process",
                "columns": 1,
                "title": "How It Works: A Simple, Local Process",
                "layout": "row",
                "items": [
                  {
                    "title": "Inspect",
                    "text": "We evaluate your crawl space, moisture levels, and air quality.",
                    "icon": "home"
                  },
                  {
                    "title": "Encapsulate",
                    "text": "We install a durable vapor barrier, seal openings, and add moisture control (like a dehumidifier).",
                    "icon": "gear"
                  },
                  {
                    "title": "Enjoy",
                    "text": "Get a drier, cleaner, healthier home with lasting protection and peace of mind.",
                    "icon": "heart"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-crawl-long-badge",
          "eyebrow": "",
          "title": "DryHome Crawlspace",
          "text": "Crawl space encapsulation & moisture control · Serving your local area · 5.0 (148+ Reviews)",
          "align": "center"
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-crawl-long-qh",
          "eyebrow": "",
          "title": "Trusted by Local Homeowners Like You",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-crawl-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-long-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "DryHome encapsulated our crawl space and the difference was amazing — no more musty smell, and our home feels healthier!",
                    "name": "Emily R., Homeowner, Rivermere",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-crawl-long/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-long-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We had high humidity and signs of mold. The DryHome team fixed it fast, explained everything, and the air in our home is so much better now.",
                    "name": "David M., Homeowner, Lakeview",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-crawl-long/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-crawl-long-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, friendly, and local. Our crawl space is now clean, dry, and protected. I'm so glad we chose DryHome Crawlspace!",
                    "name": "Maria T., Homeowner, Pinecrest",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-crawl-long/avatar3.webp"
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
          "id": "pc-crawl-long-bar",
          "text": "Ready for a Drier, Healthier Home? Get your personalized video, a free crawl space assessment, and a no-obligation estimate from DryHome Crawlspace today.",
          "label": "Get My Free Crawl Space Assessment Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
