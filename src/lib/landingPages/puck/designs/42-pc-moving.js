/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-moving",
  "name": "Moving: stress-free moves",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-moving",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ff7a1a",
    "highlight": "#ff7a1a",
    "bg": "#07142c",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-moving",
        "accent": "#ff7a1a",
        "background": "#07142c",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-moving-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-moving/logo.webp",
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
              "label": "For Moving Companies",
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
          "id": "pc-moving-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "{{firstname|there}}, Let's Make\nYour Next Move\n[[Stress-Free]]",
          "subhead": "I put together a quick, personalized video to show how Riverside Moving Co. can make your move easy, affordable, and stress-free — with fast quotes, friendly movers, and reliable service you can count on.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Moving Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-moving/poster.webp",
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
          "id": "pc-moving-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Local Moves",
              "text": "Reliable, friendly moving service in your community.",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Long-Distance Moves",
              "text": "A smooth, worry-free move across town or across the country.",
              "value": "",
              "icon": "car"
            },
            {
              "title": "Packing Help",
              "text": "Professional packing services to save you time and stress.",
              "value": "",
              "icon": "layers"
            },
            {
              "title": "Fast Quotes",
              "text": "Get a clear, no-obligation quote in minutes.",
              "value": "",
              "icon": "bolt"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-moving-form",
          "eyebrow": "",
          "title": "Get Your Personalized Moving Plan Today",
          "text": "Enter your information below to get a free moving quote, a personalized video, and a custom moving plan.",
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
              "key": "date",
              "label": "Moving Date",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Moving Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-moving-qh",
          "eyebrow": "",
          "title": "What Our Customers Say",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-moving-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-moving-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The team was on time, professional, and made our move so easy! Highly recommend!",
                    "name": "Sarah M., Local Move",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-moving/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-moving-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Fast quote, great communication, and zero stress. Best moving experience we've had!",
                    "name": "James R., Long-Distance Move",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-moving/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-moving-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "They even helped us pack! The whole process was smooth, friendly, and affordable.",
                    "name": "Emily T., Local Move",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-moving/avatar3.webp"
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
          "id": "pc-moving-bar",
          "text": "Ready for a Smoother, Stress-Free Move? Watch your personalized video, get a fast quote, and book your move today!",
          "label": "Get My Personalized Moving Demo",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
