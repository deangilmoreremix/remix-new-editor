/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-health",
  "name": "Health: patient messages",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-health",
  "theme": {
    "mode": "light",
    "accent": "#1f5fe0",
    "highlight": "#1f5fe0",
    "bg": "#e6eeff",
    "text": "#0f2350",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-health",
        "accent": "#1f5fe0",
        "background": "#e6eeff",
        "text": "#0f2350",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-health-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-health/logo.webp",
          "links": [
            {
              "label": "Home",
              "url": ""
            },
            {
              "label": "Features",
              "url": ""
            },
            {
              "label": "Contact",
              "url": ""
            }
          ],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pb-health-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Share personalized health information, offers and more.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-health/poster.webp",
          "showForm": "yes",
          "formTitle": "Get Your Personalized Video Today",
          "formSubtitle": "",
          "formFields": [
            {
              "key": "name",
              "label": "Your Name",
              "type": "text",
              "required": true
            },
            {
              "key": "email",
              "label": "Your Email",
              "type": "email",
              "required": true
            }
          ],
          "submitLabel": "Watch My Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-health-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Educate Patients",
              "text": "",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Fill Appointments",
              "text": "",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Grow Your Practice",
              "text": "",
              "value": "",
              "icon": "users"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-health-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-health-quote",
                "columns": 1,
                "heading": "What Our Patients Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps our practice connect with patients in a meaningful way.",
                    "name": "Dr. Karen Mitchell",
                    "role": "Family Physician",
                    "avatar": "/landing-art/pb-health/avatar.webp"
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-health-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "fewer no-shows",
              "text": "",
              "value": "60%",
              "icon": ""
            },
            {
              "title": "to set up",
              "text": "",
              "value": "5 min",
              "icon": ""
            },
            {
              "title": "patient rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-health-why",
          "eyebrow": "What you get",
          "title": "Everything your patients needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-health-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-health-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "heart",
                    "title": "A friendly welcome",
                    "text": "Introduce your team before the first visit."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-health-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Easy appointments",
                    "text": "Patients book from the page."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-health-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "shield",
                    "title": "Private by design",
                    "text": "Share only what you choose."
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-health-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-health-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-health-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Record a welcome",
                    "text": "A short hello from your care team.",
                    "icon": ""
                  },
                  {
                    "title": "Add the patient name",
                    "text": "Each person sees a greeting made for them.",
                    "icon": ""
                  },
                  {
                    "title": "Book the visit",
                    "text": "They schedule in one tap.",
                    "icon": ""
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-health-say",
          "eyebrow": "What people say",
          "title": "Loved by patients and families",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-health-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-health-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "New patients arrive calm and prepared.",
                    "name": "Dr. A. Chen",
                    "role": "Family clinic",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-health-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Fewer missed appointments since we started.",
                    "name": "Sam T.",
                    "role": "Practice manager",
                    "avatar": ""
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-health-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-health-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-health-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Is this private?",
                    "a": "Pages only show what you add. Do not include medical details."
                  },
                  {
                    "q": "Can patients book?",
                    "a": "Yes, through the form or a booking link."
                  },
                  {
                    "q": "Is there a free trial?",
                    "a": "Sample answer: edit this to match your offer."
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pb-health-contact",
          "eyebrow": "Let's talk",
          "title": "Request an appointment",
          "text": "Leave your details and we will get back to you. Sample text, edit it in the studio.",
          "fields": [
            {
              "key": "name",
              "label": "Your name",
              "type": "text",
              "required": true
            },
            {
              "key": "email",
              "label": "Your email",
              "type": "email",
              "required": true
            }
          ],
          "submitLabel": "Send",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Footer",
        "props": {
          "id": "pb-health-footer",
          "text": "© Your business · Sample footer",
          "links": [
            {
              "label": "Privacy",
              "url": ""
            },
            {
              "label": "Contact",
              "url": "#contact"
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pb-health-bar",
          "text": "Better connections. A healthier community.",
          "label": "Get Started",
          "url": "#lead",
          "icon": "heart"
        }
      }
    ],
    "zones": {}
  }
};
