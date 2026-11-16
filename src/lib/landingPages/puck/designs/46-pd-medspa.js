/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pd-medspa",
  "name": "Med spa: more bookings",
  "description": "Full industry landing page: video hero, lead form band, feature cards, a \"see it in action\" section, three testimonials and a closing banner. Names, quotes and figures are sample content.",
  "designClass": "pd-medspa",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "light",
    "accent": "#b8566c",
    "highlight": "#b8566c",
    "bg": "#fbeff0",
    "text": "#3a2a30",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 16,
  "puckData": {
    "root": {
      "props": {
        "design": "pd-medspa",
        "accent": "#b8566c",
        "background": "#fbeff0",
        "text": "#3a2a30",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-medspa-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-medspa/logo.webp",
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
              "label": "Resources",
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
          "id": "pd-medspa-hero",
          "variant": "copy-video-form",
          "background": "",
          "eyebrow": "FOR LOCAL MED SPAS",
          "headline": "Create Personalized\nBeauty & Aesthetic\nVideos That Get\n[[More Med Spa\nBookings]]",
          "subhead": "Use SmartVideo AI to create stunning, personalized videos for your med spa — showcase treatments, answer patient questions, and turn more local interest into consultations and booked appointments.",
          "bullets": [
            {
              "text": "Attract more local clients"
            },
            {
              "text": "Showcase your treatments & results"
            },
            {
              "text": "Turn video views into consultations & bookings"
            }
          ],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pd-medspa/poster.webp",
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
          "id": "pd-medspa-form",
          "eyebrow": "",
          "title": "Get a Personalized Med Spa Video & Growth Plan",
          "text": "Tell us about your med spa and the treatments you offer. We’ll create a custom demo video and show you how to get more local bookings.",
          "fields": [
            {
              "key": "name",
              "label": "Full Name",
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
              "key": "treatment",
              "label": "Primary Treatment Interest",
              "type": "select",
              "required": false,
              "options": "Botox,Fillers,Laser,Skin care,Body contouring,Other"
            }
          ],
          "submitLabel": "Request My Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-medspa-fh",
          "eyebrow": "",
          "title": "Powerful Features Built for Med Spas",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-medspa-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Treatment Videos",
              "text": "Create engaging, custom videos for local clients",
              "value": "",
              "icon": "play"
            },
            {
              "title": "Consultation & Booking Tools",
              "text": "Turn interest into scheduled consultations",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Before & After Showcases",
              "text": "Highlight real results and patient stories",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Local Lead Generation",
              "text": "Attract more qualified clients in your area",
              "value": "",
              "icon": "pin"
            },
            {
              "title": "Treatment Interest Forms",
              "text": "Capture leads by treatment (Botox, Fillers, Laser, Skin, & more)",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Business Growth Insights",
              "text": "Track views, leads, consultations and bookings",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-medspa-action",
          "variant": "split",
          "side": "right",
          "title": "See It In [[Action]]",
          "text": "Turn your med spa’s services into high-converting, personalized videos that educate, build trust, and bring in more bookings.",
          "bullets": [
            {
              "text": "Treatment overviews (Botox, Fillers, Laser, etc.)"
            },
            {
              "text": "Patient education & FAQs"
            },
            {
              "text": "Specials, events, and seasonal offers"
            },
            {
              "text": "Local, personalized video messages"
            }
          ],
          "buttonLabel": "Watch a Demo Video",
          "buttonUrl": "#video",
          "image": "/landing-art/pd-medspa/laptop.webp",
          "imageAlt": "The SmartVideo AI editor with a personalized video",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-medspa-qh",
          "eyebrow": "",
          "title": "Loved by Med Spa Owners Like You",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-medspa-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-medspa-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped us showcase our treatments and fill our consultation calendar. Our bookings are up 42% in just 6 weeks!",
                    "name": "Dr. Emily Carter",
                    "role": "Owner, Radiance Med Spa",
                    "avatar": "/landing-art/pd-medspa/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-medspa-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized videos look incredible, build trust, and bring in high-quality local leads. It’s now a key part of our marketing.",
                    "name": "Michael Reyes",
                    "role": "Co-Owner, Luxe Aesthetics",
                    "avatar": "/landing-art/pd-medspa/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-medspa-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "So easy to use and so effective! We’re getting more reservations, higher sales, and skin treatments in constant demand.",
                    "name": "Jessica Morgan",
                    "role": "Director, Renewal Med Spa",
                    "avatar": "/landing-art/pd-medspa/avatar3.webp"
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
          "id": "pd-medspa-cta",
          "variant": "band",
          "side": "right",
          "title": "Ready to Fill Your Med Spa’s Calendar with More Bookings?",
          "text": "Create personalized videos, generate local leads, and turn more interest into consultations — all with SmartVideo AI.",
          "bullets": [],
          "buttonLabel": "Get Started Free",
          "buttonUrl": "#lead",
          "image": "",
          "imageAlt": "",
          "background": "/landing-art/pd-medspa/band.webp",
          "points": [
            {
              "text": "Attract more local clients"
            },
            {
              "text": "Get more consultation requests"
            },
            {
              "text": "Increase treatment bookings"
            },
            {
              "text": "Grow your med spa, effortlessly"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
