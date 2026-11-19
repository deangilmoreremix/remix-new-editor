/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-cleaning",
  "name": "House cleaning: recurring bookings",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-cleaning",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19d9ff",
    "highlight": "#19d9ff",
    "bg": "#06182f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-cleaning",
        "accent": "#19d9ff",
        "background": "#06182f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-cleaning-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-cleaning/logo.webp",
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
          "id": "pc-cleaning-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "{{firstname|there}}, Get a\nCleaner Home, Easier\nScheduling, and More\n[[Recurring Bookings]]",
          "subhead": "I created a quick, personalized video to show how SmartVideo AI can help your house cleaning business attract more local clients, keep your schedule full, and grow recurring service plans.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Live Demo",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-cleaning/poster.webp",
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
          "id": "pc-cleaning-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Deep Cleaning",
              "text": "Thorough, detail-focused cleaning for a truly fresh home",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Recurring Service",
              "text": "Keep your home consistently clean with flexible plans",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Trusted Teams",
              "text": "Background-checked, professional, and friendly",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Faster Local Bookings",
              "text": "Simple online scheduling with real-time availability",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-cleaning-form",
          "eyebrow": "",
          "title": "Get a Cleaner, Happier Home",
          "text": "Enter your information below to get your personalized cleaning estimate and special local offer.",
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
          "submitLabel": "Get My Cleaning Estimate",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-cleaning-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-cleaning-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "My home has never been cleaner! The team is always on time and so thorough.",
                    "name": "Jenna R., Local Customer",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-cleaning/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-cleaning-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The recurring plan makes life so easy. I love coming home to a spotless house!",
                    "name": "Marcus D., Local Customer",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-cleaning/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-cleaning-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, friendly, and reliable. Scheduling is quick and super convenient.",
                    "name": "Elena M., Local Customer",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-cleaning/avatar3.webp"
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
          "id": "pc-cleaning-bar",
          "text": "",
          "label": "Book Your House Cleaning Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
