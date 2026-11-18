/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-realestate",
  "name": "Real estate: more buyer and seller leads",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-realestate",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19e8ff",
    "highlight": "#19e8ff",
    "bg": "#07091f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-realestate",
        "accent": "#19e8ff",
        "background": "#07091f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-realestate-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-realestate/logo.webp",
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
              "label": "Real Estate Solutions",
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
          "id": "pc-realestate-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "The Smarter Way for Real Estate\nBusinesses to [[Generate More Buyer & Seller Leads,]] Book\nConsultations, and Showcase Listings",
          "subhead": "I created a quick, personalized video to show how SmartVideo AI helps real estate professionals like you attract more buyers and sellers, fill your consultation calendar, and bring your listings to life with video.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Live Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-realestate/poster.webp",
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
          "id": "pc-realestate-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Listing Videos",
              "text": "Turn your listings, market updates, and property tips into high-impact videos.",
              "value": "",
              "icon": "home"
            },
            {
              "title": "More Engagement",
              "text": "Get higher opens, views, and responses from buyers and sellers.",
              "value": "",
              "icon": "bolt"
            },
            {
              "title": "Qualified Leads",
              "text": "Attract serious buyers and sellers who are ready to take action.",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Save Time",
              "text": "Automate follow-up with personalized videos that build trust and move deals forward.",
              "value": "",
              "icon": "clock"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-realestate-form",
          "eyebrow": "",
          "title": "Get Your Personalized Real Estate Video Demo",
          "text": "Enter your information below to see how SmartVideo AI can help you grow your real estate business.",
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
              "key": "interest",
              "label": "I'm Interested In...",
              "type": "select",
              "required": false,
              "options": "Buyer leads,Seller leads,Listing videos,Market updates,Other"
            }
          ],
          "submitLabel": "Get My Free Real Estate Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pc-realestate-show",
          "variant": "split",
          "side": "right",
          "title": "See It in [[Action]]",
          "text": "Real examples of personalized real estate videos that attract leads, showcase listings, and book more consultations.",
          "bullets": [],
          "buttonLabel": "",
          "buttonUrl": "#video",
          "image": "/landing-art/pc-realestate/showcase.webp",
          "imageAlt": "Listing Showcase, Market Update and Buyer & Seller Tips video examples",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-realestate-qh",
          "eyebrow": "",
          "title": "What Real Estate Pros Are Saying",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-realestate-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-realestate-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI has been a game-changer. We're getting more qualified leads, more consultations, and our listings are getting way more attention!",
                    "name": "Melissa R., Real Estate Broker",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-realestate/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-realestate-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized videos feel so professional and authentic. They help me build trust quickly and turn more conversations into clients.",
                    "name": "David K., REALTOR®",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-realestate/avatar2.webp"
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
          "id": "pc-realestate-bar",
          "text": "Ready to Grow Your Real Estate Business with Video? Get a personalized demo and see how SmartVideo AI can help you generate more leads, book more consultations, and showcase your listings.",
          "label": "Get My Free Real Estate Demo",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
