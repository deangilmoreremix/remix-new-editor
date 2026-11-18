/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-preschool",
  "name": "Preschool: schedule a tour",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-preschool",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ffd23a",
    "highlight": "#ffd23a",
    "bg": "#07202f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-preschool",
        "accent": "#ffd23a",
        "background": "#07202f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-preschool-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-preschool/logo.webp",
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
              "label": "Solutions",
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
          "id": "pc-preschool-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "A Safe, Nurturing Place\nto Learn, Grow, and\n[[Get Ready for School]]",
          "subhead": "Hi {{firstname|there}}! I put together a quick, personalized video to show you how SmartVideo AI Preschool offers safe classrooms, caring teachers, and an easy way to schedule a tour.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Schedule a Tour",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-preschool/poster.webp",
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
          "id": "pc-preschool-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Safe Classrooms",
              "text": "Clean, secure, and child-friendly spaces",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Early Learning",
              "text": "Play-based programs that build confidence and skills",
              "value": "",
              "icon": "book"
            },
            {
              "title": "Caring Teachers",
              "text": "Experienced, loving educators who support every child",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Simple Enrollment",
              "text": "A clear, friendly process from tour to first day",
              "value": "",
              "icon": "check"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-preschool-form",
          "eyebrow": "",
          "title": "See If Our Preschool Is the Right Fit for Your Family",
          "text": "Tell us a little about your family to get your personalized video, tour info, and a free preschool demo.",
          "fields": [
            {
              "key": "name",
              "label": "Parent Name",
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
              "key": "age",
              "label": "Child Age",
              "type": "select",
              "required": false,
              "options": "1-2 years,2-3 years,3-4 years,4-5 years"
            }
          ],
          "submitLabel": "Get My Free Preschool Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-preschool-qh",
          "eyebrow": "",
          "title": "What Parents Are Saying",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-preschool-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-preschool-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We felt the care the moment we walked in. Our daughter loves it here!",
                    "name": "Maria S.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-preschool/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-preschool-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The teachers are amazing, and we love the safe, welcoming environment.",
                    "name": "James R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-preschool/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-preschool-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "A true partner in our child's growth and early learning. Highly recommend!",
                    "name": "Danielle M.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-preschool/avatar3.webp"
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
          "id": "pc-preschool-bar",
          "text": "",
          "label": "Schedule Your Preschool Tour Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
