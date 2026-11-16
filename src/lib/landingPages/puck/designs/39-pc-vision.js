/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-vision",
  "name": "Vision center: book eye exams",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-vision",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#1ff0c4",
    "highlight": "#1ff0c4",
    "bg": "#06122a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-vision",
        "accent": "#1ff0c4",
        "background": "#06122a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-vision-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-vision/logo.webp",
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
              "label": "For Vision Centers",
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
          "id": "pc-vision-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personal Video for {{firstname|there}}",
          "headline": "Get Clearer Vision,\nExpert Eye Exams, and\n[[Book Your Appointment Today]]",
          "subhead": "Hi {{firstname|there}}! I created a short, personalized video to show you how our eye exams, eyewear, and vision care can help you see, feel, and live better.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule an Eye Exam",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-vision/poster.webp",
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
          "id": "pc-vision-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Comprehensive Eye Exams",
              "text": "Thorough, comfortable exams to keep your vision healthy",
              "value": "",
              "icon": "book"
            },
            {
              "title": "Designer Frames",
              "text": "A curated selection of stylish, high-quality frames",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Contact Lenses",
              "text": "Top brands and personalized fittings for lasting comfort",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Family Eye Care",
              "text": "Expert vision care for kids, teens, and adults of all ages",
              "value": "",
              "icon": "users"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-vision-form",
          "eyebrow": "",
          "title": "Get a Personalized Vision Plan for You",
          "text": "Enter your information below to get your free personalized vision demo and special offers.",
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
              "label": "Service Interest",
              "type": "select",
              "required": false,
              "options": "Eye exam,Eyeglasses,Contact lenses,Kids vision,Other"
            }
          ],
          "submitLabel": "Get My Free Vision Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-vision-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-vision-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The eye exam was thorough, the staff was friendly, and I love my new frames!",
                    "name": "Sarah M.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-vision/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-vision-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, caring, and efficient. They took the time to explain everything clearly.",
                    "name": "James T.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-vision/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-vision-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Great experience for my whole family. Everyone feels well cared for here!",
                    "name": "Emily R.",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-vision/avatar3.webp"
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
          "id": "pc-vision-bar",
          "text": "",
          "label": "Book Your Eye Exam Appointment Today",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
