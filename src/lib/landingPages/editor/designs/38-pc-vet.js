/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-vet",
  "name": "Veterinary: compassionate pet care",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-vet",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19e0ff",
    "highlight": "#19e0ff",
    "bg": "#0a0b26",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-vet",
        "accent": "#19e0ff",
        "background": "#0a0b26",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-vet-nav",
          "brand": "SmartVideo AI | Riverside Veterinary Clinic",
          "logo": "/landing-art/pc-vet/logo.webp",
          "links": [
            {
              "label": "Our Care",
              "url": ""
            },
            {
              "label": "Services",
              "url": ""
            },
            {
              "label": "Pet Resources",
              "url": ""
            },
            {
              "label": "About Us",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            }
          ],
          "loginLabel": "Book an Appointment",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-vet-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{custom2|there}}",
          "headline": "{{custom2|there}},\nCompassionate Pet Care\nfor a [[Healthier, Happier Pet]]",
          "subhead": "I recorded a quick, personalized video to welcome you to Riverside Veterinary Clinic and show how our caring team makes wellness visits, pet care, and appointment bookings easier.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Book an Appointment Now",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-vet/poster.webp",
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
          "id": "pc-vet-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Wellness Exams",
              "text": "Keep your pet healthy with preventative care.",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Vaccinations",
              "text": "Essential protection for a long, healthy life.",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Pet Dentistry",
              "text": "Maintain a healthy smile and overall wellness.",
              "value": "",
              "icon": "star"
            },
            {
              "title": "New Patient Bookings",
              "text": "Get started easily and schedule your first visit today.",
              "value": "",
              "icon": "calendar"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-vet-form",
          "eyebrow": "",
          "title": "Get Started at Riverside Veterinary Clinic",
          "text": "Enter your information below to receive a personalized video, care tips, and easy appointment booking.",
          "fields": [
            {
              "key": "name",
              "label": "Pet Owner's Name",
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
          "submitLabel": "Get My Personalized Video",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-vet-qh",
          "eyebrow": "",
          "title": "What Pet Owners Are Saying",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-vet-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-vet-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The team is so caring and genuinely loves pets. Wellness visits are always a great experience!",
                    "name": "Megan R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-vet/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-vet-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Easy to book, friendly staff, and excellent care. My dog actually looks forward to visits!",
                    "name": "Daniel K.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-vet/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-vet-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The dentistry care made a huge difference for my cat. Professional, compassionate, and thorough!",
                    "name": "Linda S.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-vet/avatar3.webp"
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
          "id": "pc-vet-bar",
          "text": "Compassionate Pet Care Is Just a Click Away — Book a wellness visit, get trusted care, and keep your pet happy and healthy.",
          "label": "Book an Appointment Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
