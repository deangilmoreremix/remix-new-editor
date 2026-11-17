/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-hvac",
  "name": "HVAC: more service calls and installs",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-hvac",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19d9ff",
    "highlight": "#19d9ff",
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
        "design": "pc-hvac",
        "accent": "#19d9ff",
        "background": "#06122b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-hvac-nav",
          "brand": "SmartVideo AI | Personalized Video for HVAC Businesses",
          "logo": "/landing-art/pc-hvac/logo.webp",
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
          "id": "pc-hvac-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "A Smarter Way for HVAC\nCompanies to Get More\n[[Service Calls, Tune-Ups, Installs & Emergency Jobs]]",
          "subhead": "I put together a quick, personalized video just for you to show how SmartVideo AI helps HVAC companies like yours get more qualified leads, booked service calls, and higher-value installs.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Service Call",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-hvac/poster.webp",
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
          "id": "pc-hvac-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "AC Repair",
              "text": "Get more cooling service calls, especially in peak season.",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Heating Service",
              "text": "Keep your schedule full with furnace and heat pump jobs.",
              "value": "",
              "icon": "bolt"
            },
            {
              "title": "Maintenance Plans",
              "text": "Grow recurring revenue with seasonal tune-ups and service plans.",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Same-Day Service",
              "text": "Turn more local searches into booked, same-day service calls.",
              "value": "",
              "icon": "clock"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-hvac-form",
          "eyebrow": "",
          "title": "Get a Customized HVAC Growth Demo for Your Business",
          "text": "Enter your information below to get your personalized demo, proven HVAC growth ideas, and free resources.",
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
              "key": "service",
              "label": "Service Needed",
              "type": "select",
              "required": false,
              "options": "AC repair,Heating,Maintenance plan,New install,Emergency"
            }
          ],
          "submitLabel": "Get My Free HVAC Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-hvac-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-hvac-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We've seen a 42% increase in service calls since using SmartVideo AI. The personalized videos really work!",
                    "name": "Mike R., Rivertown HVAC",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-hvac/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-hvac-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our tune-up plan sign-ups are way up, and we're booking more installs than ever. This is a game-changer for HVAC!",
                    "name": "Lisa T., Summit Heating & Cooling",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-hvac/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-hvac-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps us stand out locally and brings in real, qualified leads — including emergency calls, which are huge for us.",
                    "name": "Daniel M., Lakeside HVAC",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-hvac/avatar3.webp"
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
          "id": "pc-hvac-bar",
          "text": "Trusted by HVAC Companies Nationwide — 5.0 Avg. Rating · Proven Results · HVAC Industry Focused · Get More Service Calls · Grow Tune-Ups & Installations",
          "label": "Get Your Free HVAC Demo Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
