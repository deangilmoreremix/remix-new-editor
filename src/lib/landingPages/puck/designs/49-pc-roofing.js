/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-roofing",
  "name": "Roofing: more inspections and jobs",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-roofing",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ff8a1f",
    "highlight": "#ff8a1f",
    "bg": "#06122b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-roofing",
        "accent": "#ff8a1f",
        "background": "#06122b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-roofing-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-roofing/logo.webp",
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
              "label": "For Roofers",
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
          "id": "pc-roofing-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "{{firstname|there}}, Here's a\nSmarter Way to Help Your\nRoofing Company [[Book More Inspections, Repair Jobs, and Roof Replacements]]",
          "subhead": "I put together a quick, personalized video to show how SmartVideo AI helps roofing companies like yours get more qualified leads, book more inspections, and fill your schedule with high-value repair and replacement jobs.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Roof Inspection",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-roofing/poster.webp",
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
          "id": "pc-roofing-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Roof Inspections",
              "text": "Thorough, honest inspections with a clear, detailed report",
              "value": "",
              "icon": "book"
            },
            {
              "title": "Storm Damage Repair",
              "text": "Fast, reliable roof repairs after storms, wind, or hail",
              "value": "",
              "icon": "bolt"
            },
            {
              "title": "Full Roof Replacement",
              "text": "Durable, high-quality roofs built to last",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Local & Trusted Service",
              "text": "A reputable, local roofing team your community can count on",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-roofing-form",
          "eyebrow": "",
          "title": "Get More Roofing Jobs for Your Business",
          "text": "Enter your information below to get your personalized demo and a free roofing growth plan.",
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
              "key": "issue",
              "label": "Roof Issue (Select One)",
              "type": "select",
              "required": false,
              "options": "Leak,Storm damage,Inspection,Replacement,Other"
            }
          ],
          "submitLabel": "Get My Free Roofing Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-roofing-qh",
          "eyebrow": "",
          "title": "What Roofers Are Saying About SmartVideo AI",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-roofing-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-roofing-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We booked 42 more roof inspections in our first 30 days. The personalized videos really work!",
                    "name": "Mike R., Skyline Roofing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-roofing/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-roofing-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The easiest way we've found to get more qualified repair and replacement jobs. Total game-changer.",
                    "name": "Jessica L., Riverbend Roofing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-roofing/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-roofing-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our phone is ringing, our calendar is full, and we're closing more high-value jobs than ever before.",
                    "name": "Tom K., Crestview Roofing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-roofing/avatar3.webp"
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
          "id": "pc-roofing-bar",
          "text": "Trusted by Local Roofing Companies — BBB Accredited · Google 5.0 · Licensed & Insured · Locally Owned & Operated",
          "label": "Book Your SmartVideo AI Demo Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
