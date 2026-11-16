/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pd-salon",
  "name": "Hair salon: book more appointments",
  "description": "Full industry landing page: video hero, lead form band, feature cards, a \"see it in action\" section, three testimonials and a closing banner. Names, quotes and figures are sample content.",
  "designClass": "pd-salon",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "light",
    "accent": "#c0316b",
    "highlight": "#c0316b",
    "bg": "#fdeef6",
    "text": "#3a2231",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 16,
  "puckData": {
    "root": {
      "props": {
        "design": "pd-salon",
        "accent": "#c0316b",
        "background": "#fdeef6",
        "text": "#3a2231",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-salon-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-salon/logo.webp",
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
              "label": "For Salons",
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
          "ctaLabel": "Get Started Free"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pd-salon-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "For Local Hair & Beauty Salons",
          "headline": "Create Personalized\nVideos That Help Your\nSalon Book [[More\nAppointments & Build\nClient Loyalty]]",
          "subhead": "SmartVideo AI makes it easy to create custom videos for skincare, hair, color, and beauty services — so you can attract new clients, fill your calendar, and keep your clients coming back.",
          "bullets": [
            {
              "text": "Personalized client videos & style recommendations"
            },
            {
              "text": "Promote specials, new services & seasonal offers"
            },
            {
              "text": "Turn inquiries into booked appointments"
            }
          ],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pd-salon/poster.webp",
          "showForm": "no",
          "formTitle": "",
          "formSubtitle": "",
          "formFields": [],
          "submitLabel": "",
          "privacy": ""
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pd-salon-form",
          "eyebrow": "",
          "title": "Get a Free Personalized Demo for Your Salon",
          "text": "",
          "fields": [
            {
              "key": "salon",
              "label": "Salon Name",
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
          "submitLabel": "Request My Salon Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-salon-fh",
          "eyebrow": "",
          "title": "Powerful Salon-Focused Features",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-salon-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Book More Appointments",
              "text": "Turn interest into confirmed bookings",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Personalized Client Videos",
              "text": "Send custom style, color or treatment recommendations",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Promote Salon Offers",
              "text": "Highlight specials, new services & seasonal packages",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Build Client Loyalty",
              "text": "Stay in touch with follow-ups, birthday messages & VIP offers",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Grow Your Salon Business",
              "text": "Get more clients, more rebookings and higher revenue",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-salon-action",
          "variant": "split",
          "side": "right",
          "title": "See It In [[Action]]",
          "text": "Watch how SmartVideo AI helps salons like yours attract new clients, showcase services, and turn interest into booked appointments — in just minutes.",
          "bullets": [],
          "buttonLabel": "Watch Demo Video",
          "buttonUrl": "#video",
          "image": "/landing-art/pd-salon/laptop.webp",
          "imageAlt": "The SmartVideo AI editor with a personalized video",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-salon-qh",
          "eyebrow": "",
          "title": "Trusted by Local Salons & Beauty Professionals",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-salon-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-salon-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We’ve booked so many more appointments since using SmartVideo AI. Our clients love the personalized style videos!",
                    "name": "Amanda Rivera",
                    "role": "Salon Owner, Bella Hair Studio",
                    "avatar": "/landing-art/pd-salon/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-salon-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "It’s like having a marketing assistant for our salon. We promote our specials, rebook clients, and keep in touch — all with videos!",
                    "name": "Jessica Lane",
                    "role": "Owner, Glow Beauty Salon",
                    "avatar": "/landing-art/pd-salon/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-salon-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Super easy to use and incredibly effective. It helped us attract new clients and build real loyalty with our regulars.",
                    "name": "Maria Santos",
                    "role": "Stylist & Salon Manager",
                    "avatar": "/landing-art/pd-salon/avatar3.webp"
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
          "id": "pd-salon-cta",
          "variant": "band",
          "side": "right",
          "title": "Ready to Grow Your Salon?",
          "text": "Get more appointments, showcase your services, and turn clients into loyal, long-term customers with SmartVideo AI.",
          "bullets": [],
          "buttonLabel": "Get Started Free Today",
          "buttonUrl": "#lead",
          "image": "",
          "imageAlt": "",
          "background": "/landing-art/pd-salon/band.webp",
          "points": [
            {
              "text": "Free to try"
            },
            {
              "text": "No credit card required"
            },
            {
              "text": "Set up in minutes"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
