/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-gym",
  "name": "Gym: more members and training sign-ups",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-gym",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#8cff1f",
    "highlight": "#8cff1f",
    "bg": "#050d12",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-gym",
        "accent": "#8cff1f",
        "background": "#050d12",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-gym-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-gym/logo.webp",
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
              "label": "For Gyms",
              "url": ""
            },
            {
              "label": "Resources",
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
          "id": "pc-gym-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "{{firstname|there}}, Here's a\nSmarter Way for Gyms to\n[[Increase Memberships, Personal Training Sign-Ups, Class Bookings and Retention]]",
          "subhead": "I put together a quick, personalized video just for you to show how SmartVideo AI helps gyms like Summit Fitness attract more members, fill more classes, get more personal training sign-ups, and keep members coming back longer.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Free Trial",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-gym/poster.webp",
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
          "id": "pc-gym-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "More Personal Training",
              "text": "Turn more interest into paid training programs",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Fuller Group Classes",
              "text": "Boost class bookings and keep your schedule full",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Grow Memberships",
              "text": "Attract more members and increase long-term retention",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Automated Follow-Up",
              "text": "Personalized videos that nurture leads, re-engage past members, and fill your pipeline 24/7",
              "value": "",
              "icon": "bolt"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-gym-form",
          "eyebrow": "",
          "title": "Get a Free, Personalized Summit Fitness Growth Demo",
          "text": "Enter your information below to get your personalized video, a free demo, and gym growth tips.",
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
              "key": "goal",
              "label": "Fitness Goal",
              "type": "select",
              "required": false,
              "options": "Lose weight,Build muscle,Personal training,Group classes,Other"
            }
          ],
          "submitLabel": "Get My Free Summit Fitness Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-gym-qh",
          "eyebrow": "",
          "title": "Trusted by Summit Fitness Owners Like You",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-gym-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-gym-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped us increase memberships by 37% in 60 days and fill our personal training schedule!",
                    "name": "Jessica R., Owner, Summit Fitness",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-gym/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-gym-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our class bookings are up, leads respond faster, and our member retention has never been higher.",
                    "name": "Mark T., Owner, Summit Fitness",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-gym/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-gym-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized videos feel personal and high-touch, and they've made a huge difference in our sign-ups!",
                    "name": "Danielle M., Owner, Summit Fitness",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-gym/avatar3.webp"
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
          "id": "pc-gym-bar",
          "text": "Ready to Grow Your Summit Fitness? Get more members, more training sign-ups, more class bookings, and stronger retention with SmartVideo AI.",
          "label": "Get My Free Summit Fitness Demo Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
