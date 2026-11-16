/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-pest",
  "name": "Pest control: protect homes",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-pest",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#9bff1f",
    "highlight": "#9bff1f",
    "bg": "#05120c",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-pest",
        "accent": "#9bff1f",
        "background": "#05120c",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-pest-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-pest/logo.webp",
          "links": [
            {
              "label": "How It Works",
              "url": ""
            },
            {
              "label": "Services",
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
              "label": "Reviews",
              "url": ""
            }
          ],
          "loginLabel": "Book Inspection",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-pest-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for Homeowners in {{custom1|your city}}",
          "headline": "Say Goodbye to Pests.\nA Smarter Way to\n[[Protect Your Home.]]",
          "subhead": "I put together a quick, personalized video to show how our local pest control team can eliminate pests, prevent them from coming back, and give you lasting peace of mind.",
          "bullets": [],
          "buttons": [
            {
              "label": "Book Your Inspection Today",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Free Home Assessment",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-pest/poster.webp",
          "showForm": "no",
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
          "id": "pc-pest-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Termite Control",
              "text": "Detect, eliminate, and protect your home from costly termite damage",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Mosquito Treatment",
              "text": "Reduce mosquito populations and enjoy your outdoor spaces again",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Rodent Protection",
              "text": "Keep rats and mice out with proven, long-lasting solutions",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Recurring Service Plans",
              "text": "Year-round protection with affordable, hassle-free plans",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-pest-form",
          "eyebrow": "",
          "title": "Get a Free Inspection",
          "text": "Enter your information below to schedule your no-obligation pest inspection.",
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
          "submitLabel": "Book My Inspection",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-pest-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pest-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "They eliminated our ant and rodent problem quickly. Friendly, professional, and local!",
                    "name": "Melissa R., {{custom1|your city}}",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pest/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pest-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our termite treatment was thorough and stress-free. Highly recommend!",
                    "name": "David K., {{custom1|your city}}",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pest/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-pest-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The recurring service plan keeps our home pest-free year-round. It's worth every penny!",
                    "name": "Erin M., {{custom1|your city}}",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-pest/avatar3.webp"
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
          "id": "pc-pest-bar",
          "text": "Eliminate Pests. Protect Your Home. Book Your Inspection Today!",
          "label": "Get Started Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
