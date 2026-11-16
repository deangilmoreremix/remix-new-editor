/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-landscape",
  "name": "Landscaping: transform yards",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-landscape",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#a6ff2e",
    "highlight": "#a6ff2e",
    "bg": "#06200f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-landscape",
        "accent": "#a6ff2e",
        "background": "#06200f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-landscape-nav",
          "brand": "GreenLeaf Landscaping",
          "logo": "/landing-art/pc-landscape/logo.webp",
          "links": [
            {
              "label": "Our Services",
              "url": ""
            },
            {
              "label": "Our Work",
              "url": ""
            },
            {
              "label": "Testimonials",
              "url": ""
            },
            {
              "label": "About Us",
              "url": ""
            },
            {
              "label": "Contact",
              "url": ""
            }
          ],
          "loginLabel": "Call Now",
          "loginUrl": "#lead",
          "ctaLabel": "Book an Estimate"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-landscape-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "{{firstname|there}}, Let's\nTransform Your Yard into\na [[Beautiful Outdoor Space]]",
          "subhead": "I put together a quick, personalized video to show you how GreenLeaf Landscaping can transform your yard — with expert care, custom design, and a hassle-free process.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Book a Free Estimate Today",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-landscape/poster.webp",
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
          "id": "pc-landscape-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Lawn Care",
              "text": "Healthy, green, and well-maintained lawns",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Landscape Design",
              "text": "Custom outdoor spaces that fit your style and home",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Seasonal Cleanups",
              "text": "Keep your yard clean, healthy, and ready for every season",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Curb Appeal Growth",
              "text": "A more beautiful yard that adds lasting value to your home",
              "value": "",
              "icon": "home"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-landscape-form",
          "eyebrow": "",
          "title": "Book Your Free Yard Estimate",
          "text": "Enter your information below to schedule your free, no-obligation estimate.",
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
          "submitLabel": "Book My Free Estimate",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-landscape-qh",
          "eyebrow": "",
          "title": "What Homeowners Are Saying",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-landscape-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-landscape-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our yard has never looked better! The team is professional, reliable, and detail-oriented.",
                    "name": "Melissa R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-landscape/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-landscape-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "They transformed our backyard into a space we actually use and love. Highly recommend!",
                    "name": "James T.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-landscape/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-landscape-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Great communication, fair pricing, and amazing results. Our curb appeal has gone through the roof!",
                    "name": "Danielle M.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-landscape/avatar3.webp"
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
          "id": "pc-landscape-bar",
          "text": "Ready to Transform Your Yard? Get a free, no-obligation estimate and see what's possible for your outdoor space.",
          "label": "Book Your Free Estimate Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
