/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-plumbing",
  "name": "Plumbing: more service calls",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-plumbing",
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
        "design": "pc-plumbing",
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
          "id": "pc-plumbing-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-plumbing/logo.webp",
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
          "id": "pc-plumbing-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "Book More Plumbing\nService Calls &\n[[Emergency Jobs]]",
          "subhead": "I put together a quick, personalized video just for you to show how SmartVideo AI can help your plumbing business get more service calls, more emergency jobs, and more local customers — without more marketing headaches.",
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
          "photo": "/landing-art/pc-plumbing/poster.webp",
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
          "id": "pc-plumbing-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "More Service Calls",
              "text": "Get more plumbing jobs from local homeowners.",
              "value": "",
              "icon": "gear"
            },
            {
              "title": "More Emergency Jobs",
              "text": "Turn urgent plumbing needs into booked jobs, fast.",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Higher Revenue",
              "text": "Fill your schedule with high-value plumbing work.",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Save Time",
              "text": "Automate your outreach and follow up with leads.",
              "value": "",
              "icon": "clock"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-plumbing-form",
          "eyebrow": "",
          "title": "Get More Plumbing Jobs in Your Area",
          "text": "Enter your information below to get your personalized demo, free resources, and local growth tips.",
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
              "key": "service",
              "label": "Service Need",
              "type": "select",
              "required": false,
              "options": "Emergency repair,Water heater,Drain cleaning,Remodel,Other"
            }
          ],
          "submitLabel": "Get My Personalized Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-plumbing-qh",
          "eyebrow": "",
          "title": "What Local Plumbers Are Saying",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-plumbing-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-plumbing-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We're getting more service calls and emergency jobs every week!",
                    "name": "Mike R., Eastview Plumbing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-plumbing/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-plumbing-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized videos are a game-changer for our business!",
                    "name": "Jenna L., Lakeside Plumbing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-plumbing/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-plumbing-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We've seen a real boost in booked jobs and overall revenue.",
                    "name": "Carlos D., Metro Plumbing",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-plumbing/avatar3.webp"
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
          "id": "pc-plumbing-bar",
          "text": "",
          "label": "Book Your Free Demo",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
