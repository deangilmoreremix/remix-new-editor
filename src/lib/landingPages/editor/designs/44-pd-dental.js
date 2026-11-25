/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pd-dental",
  "name": "Dental: bring in new patients",
  "description": "Full industry landing page: video hero, lead form band, feature cards, a \"see it in action\" section, three testimonials and a closing banner. Names, quotes and figures are sample content.",
  "designClass": "pd-dental",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "light",
    "accent": "#1f5fe0",
    "highlight": "#1f5fe0",
    "bg": "#eaf3ff",
    "text": "#1c2b4a",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 16,
  "editorData": {
    "root": {
      "props": {
        "design": "pd-dental",
        "accent": "#1f5fe0",
        "background": "#eaf3ff",
        "text": "#1c2b4a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-dental-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-dental/logo.webp",
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
              "label": "For Dentists",
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
          "id": "pd-dental-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "For Local Dental Practices",
          "headline": "Personalized Dental\nVideos That Bring In\n[[New Patients]]",
          "subhead": "Create custom, professional videos for your dental practice in minutes. Educate patients, showcase your services, build trust, and turn more local interest into booked appointments.",
          "bullets": [
            {
              "text": "Attract more new patients in your area"
            },
            {
              "text": "Build trust and reduce appointment hesitations"
            },
            {
              "text": "Highlight treatments, technology, and your team"
            }
          ],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pd-dental/poster.webp",
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
          "id": "pd-dental-form",
          "eyebrow": "",
          "title": "Get a Free Personalized Demo for Your Dental Practice",
          "text": "See how SmartVideo AI can help you attract more local patients and grow your practice.",
          "fields": [
            {
              "key": "name",
              "label": "Your Name",
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
          "submitLabel": "Request My Free Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-dental-fh",
          "eyebrow": "",
          "title": "Powerful Features Built for Dental Practices",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-dental-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Patient Videos",
              "text": "Custom videos for treatments, reminders, and education",
              "value": "",
              "icon": "play"
            },
            {
              "title": "Local Patient Lead Capture",
              "text": "Turn website visitors into consultation requests",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Appointment Booking Integration",
              "text": "Get more visits with easy online scheduling",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Treatment Showcase Videos",
              "text": "Highlight services like cleanings, implants, Invisalign®, and more",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Practice Growth & Marketing Tools",
              "text": "Generate more reviews, referrals, and new patients",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-dental-action",
          "variant": "split",
          "side": "right",
          "title": "See It In [[Action]]",
          "text": "Turn your dental services into engaging, personalized videos that educate, build trust, and bring in new patients from your local area.",
          "bullets": [
            {
              "text": "Introduce your practice and team"
            },
            {
              "text": "Explain popular treatments (e.g., implants, Invisalign®)"
            },
            {
              "text": "Share patient education and care tips"
            },
            {
              "text": "Drive consultation and appointment bookings"
            }
          ],
          "buttonLabel": "Watch Demo Video",
          "buttonUrl": "#video",
          "image": "/landing-art/pd-dental/laptop.webp",
          "imageAlt": "The SmartVideo AI editor with a personalized video",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-dental-qh",
          "eyebrow": "",
          "title": "Trusted by Local Dental Practices",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-dental-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-dental-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI made it easy to create professional videos that actually bring in new patients. We’ve seen a noticeable increase in consultation requests!",
                    "name": "Dr. Michael Carter",
                    "role": "Riverside Dental Care",
                    "avatar": "/landing-art/pd-dental/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-dental-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our treatment videos have helped patients feel more comfortable and confident about scheduling. It’s been a game-changer for our practice!",
                    "name": "Dr. Emily Brooks",
                    "role": "Maplewood Family Dentistry",
                    "avatar": "/landing-art/pd-dental/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-dental-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalization and local marketing tools are incredible. We’re getting more new patient appointments than ever before.",
                    "name": "Dr. James Reynolds",
                    "role": "Lakeside Dental Group",
                    "avatar": "/landing-art/pd-dental/avatar3.webp"
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
          "id": "pd-dental-cta",
          "variant": "band",
          "side": "right",
          "title": "Grow Your Dental Practice\nWith SmartVideo AI",
          "text": "Attract more local patients, fill your appointment schedule, and build a stronger, more trusted practice — all with the power of personalized video.",
          "bullets": [],
          "buttonLabel": "Get Started Free Today",
          "buttonUrl": "#lead",
          "image": "",
          "imageAlt": "",
          "background": "/landing-art/pd-dental/band.webp",
          "points": [
            {
              "text": "Create professional videos in minutes"
            },
            {
              "text": "Generate more local patient leads"
            },
            {
              "text": "Get more consultation and appointment bookings"
            },
            {
              "text": "No credit card required"
            },
            {
              "text": "Dedicated support for dental practices"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
