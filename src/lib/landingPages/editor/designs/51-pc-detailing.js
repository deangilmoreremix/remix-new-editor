/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-detailing",
  "name": "Auto detailing: more bookings",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-detailing",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19d9ff",
    "highlight": "#19d9ff",
    "bg": "#050c1c",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-detailing",
        "accent": "#19d9ff",
        "background": "#050c1c",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-detailing-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-detailing/logo.webp",
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
          "id": "pc-detailing-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "Here's a Smarter Way to Help\nAuto Detailing Companies\n[[Book More Washes, Paint Correction, Ceramic Coating, and Interior Detailing]] Appointments.",
          "subhead": "I put together a quick, personalized video to show how SmartVideo AI can help your auto detailing business get more high-quality bookings, increase revenue, and keep your bays full.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Book a Detailing Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-detailing/poster.webp",
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
          "id": "pc-detailing-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Ceramic Coating",
              "text": "Showcase long-lasting protection and premium shine",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Interior Detailing",
              "text": "Highlight deep cleaning, stain removal, and a like-new interior",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Paint Correction",
              "text": "Promote swirl removal, scratch reduction, and a flawless finish",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Recurring Maintenance Plans",
              "text": "Turn one-time detail customers into long-term, repeat clients",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-detailing-form",
          "eyebrow": "",
          "title": "Get More Detailing Appointments for Your Business",
          "text": "Enter your information below to get your personalized demo and free auto detailing growth resources.",
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
              "key": "vehicle",
              "label": "Vehicle Type",
              "type": "select",
              "required": false,
              "options": "Car,SUV,Truck,Luxury,Fleet"
            }
          ],
          "submitLabel": "Get My Free Detailing Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-detailing-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-detailing-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped us book 37% more detailing appointments in just 30 days. The personalized videos really work!",
                    "name": "Mike R., Owner, Elite Auto Detailing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-detailing/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-detailing-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our ceramic coating and paint correction bookings are up, and we're getting higher-quality leads who already know what we offer.",
                    "name": "Jenna L., Owner, Pristine Auto Spa",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-detailing/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-detailing-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized videos make our business stand out and get more customers to book interior details and maintenance plans.",
                    "name": "Carlos M., Owner, Shine Pro Detailing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-detailing/avatar3.webp"
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
          "id": "pc-detailing-bar",
          "text": "Book More Auto Detailing Appointments. Grow Your Revenue. Fill Your Schedule.",
          "label": "Book Your Detailing Demo Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
