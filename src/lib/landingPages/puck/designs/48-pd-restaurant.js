/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pd-restaurant",
  "name": "Restaurant: more reservations",
  "description": "Full industry landing page: video hero, lead form band, feature cards, a \"see it in action\" section, three testimonials and a closing banner. Names, quotes and figures are sample content.",
  "designClass": "pd-restaurant",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#f6b63a",
    "highlight": "#f6b63a",
    "bg": "#2a0b0c",
    "text": "#f6efe8",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 16,
  "puckData": {
    "root": {
      "props": {
        "design": "pd-restaurant",
        "accent": "#f6b63a",
        "background": "#2a0b0c",
        "text": "#f6efe8",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-restaurant-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-restaurant/logo.webp",
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
              "label": "For Restaurants",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            },
            {
              "label": "Results",
              "url": ""
            }
          ],
          "loginLabel": "Book a Demo",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started Free"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pd-restaurant-hero",
          "variant": "copy-video-form",
          "background": "",
          "eyebrow": "Built for Local Restaurants",
          "headline": "Personalized Videos That\n[[Drive More Reservations,\nCatering Inquiries &\nRepeat Customers]]",
          "subhead": "SmartVideo AI helps restaurants create personalized, high-converting videos that fill tables, book more catering events, and turn one-time diners into loyal regulars.",
          "bullets": [
            {
              "text": "Attract more reservations"
            },
            {
              "text": "Get catering and event inquiries"
            },
            {
              "text": "Run targeted dining promotions"
            },
            {
              "text": "Build lasting customer loyalty"
            }
          ],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pd-restaurant/poster.webp",
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
        "type": "ContactBand",
        "props": {
          "id": "pd-restaurant-form",
          "eyebrow": "",
          "title": "Grow Your Restaurant with Personalized Video",
          "text": "Get a free demo, restaurant video strategy, and a custom growth plan.",
          "fields": [
            {
              "key": "restaurant",
              "label": "Restaurant Name",
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
              "key": "interest",
              "label": "I'm Interested In...",
              "type": "select",
              "required": false,
              "options": "Reservations,Catering,Events,Promotions,Other"
            }
          ],
          "submitLabel": "Get My Free Restaurant Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-restaurant-fh",
          "eyebrow": "",
          "title": "Powerful Features for Restaurant Growth",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-restaurant-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Drive Reservations",
              "text": "Turn interest into confirmed table bookings.",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Get Catering Inquiries",
              "text": "Promote catering, private events, and group dining.",
              "value": "",
              "icon": "cutlery"
            },
            {
              "title": "Run Dining Promotions",
              "text": "Fill seats with limited-time offers, specials, and events.",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Build Loyalty",
              "text": "Send personalized videos to bring customers back.",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Grow Your Sales",
              "text": "More diners, more events, more repeat business.",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-restaurant-action",
          "variant": "split",
          "side": "right",
          "title": "See It In [[Action]]",
          "text": "Watch how a restaurant uses SmartVideo AI to promote a seasonal menu, drive reservations, and book more catering events — all with personalized video.",
          "bullets": [],
          "buttonLabel": "Watch Restaurant Demo",
          "buttonUrl": "#video",
          "image": "/landing-art/pd-restaurant/laptop.webp",
          "imageAlt": "The SmartVideo AI editor with a personalized video",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-restaurant-qh",
          "eyebrow": "",
          "title": "Trusted by Local Restaurant Owners",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-restaurant-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-restaurant-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We filled 40% more tables in just 30 days. The personalized videos brought customers in and kept them coming back!",
                    "name": "Maria Lopez",
                    "role": "Owner, The Olive Bistro",
                    "avatar": "/landing-art/pd-restaurant/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-restaurant-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our catering inquiries nearly doubled after we started using SmartVideo AI. It’s been a game-changer for our business!",
                    "name": "Chef Dan Carter",
                    "role": "Owner, Riverstone Grill",
                    "avatar": "/landing-art/pd-restaurant/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-restaurant-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "So easy to use and the results were incredible — more reservations, higher sales, and lots of repeat customers!",
                    "name": "Anita Patel",
                    "role": "Manager, Maple & Vine",
                    "avatar": "/landing-art/pd-restaurant/avatar3.webp"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-restaurant-cta",
          "variant": "band",
          "side": "right",
          "title": "Ready to Fill More Tables\nand [[Grow Your Restaurant?]]",
          "text": "Create personalized videos, attract more reservations, book more catering events, and turn diners into loyal regulars — with SmartVideo AI.",
          "bullets": [],
          "buttonLabel": "Get Started Free",
          "buttonUrl": "#lead",
          "image": "",
          "imageAlt": "",
          "background": "/landing-art/pd-restaurant/band.webp",
          "points": [
            {
              "text": "Free to try"
            },
            {
              "text": "No credit card required"
            },
            {
              "text": "Get a custom demo"
            },
            {
              "text": "Start growing in minutes"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
