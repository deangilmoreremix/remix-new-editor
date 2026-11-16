/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pd-chiro",
  "name": "Chiropractic: attract local patients",
  "description": "Full industry landing page: video hero, lead form band, feature cards, a \"see it in action\" section, three testimonials and a closing banner. Names, quotes and figures are sample content.",
  "designClass": "pd-chiro",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "light",
    "accent": "#0b8f86",
    "highlight": "#0b8f86",
    "bg": "#e9f7f6",
    "text": "#16363c",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 16,
  "puckData": {
    "root": {
      "props": {
        "design": "pd-chiro",
        "accent": "#0b8f86",
        "background": "#e9f7f6",
        "text": "#16363c",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pd-chiro-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pd-chiro/logo.webp",
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
              "label": "For Chiropractors",
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
          "id": "pd-chiro-hero",
          "variant": "copy-video-form",
          "background": "",
          "eyebrow": "Built for Chiropractic Clinics",
          "headline": "Personalized Videos\nThat Help Chiropractors\nAttract & Convert\n[[More Local Patients]]",
          "subhead": "Create customized, professional videos in minutes to educate, build trust, and bring more patients through your doors — all with SmartVideo AI.",
          "bullets": [
            {
              "text": "Attract more local patients"
            },
            {
              "text": "Convert interest into consultations"
            },
            {
              "text": "Grow a healthier, more profitable practice"
            }
          ],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pd-chiro/poster.webp",
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
          "id": "pd-chiro-form",
          "eyebrow": "",
          "title": "Get More Patients for Your Chiropractic Practice",
          "text": "Request a Free Demo & See How SmartVideo AI Can Grow Your Practice",
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
          "submitLabel": "Book My Free Demo",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-chiro-fh",
          "eyebrow": "",
          "title": "Powerful Features Built for Chiropractors",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pd-chiro-features",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Patient Videos",
              "text": "Send customized videos for new and existing patients.",
              "value": "",
              "icon": "play"
            },
            {
              "title": "Local Lead Capture",
              "text": "Build your email list and attract more patients from your area.",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Consultation Signups",
              "text": "Make it easy for patients to request a consultation or first visit.",
              "value": "",
              "icon": "check"
            },
            {
              "title": "Practice Growth Tools",
              "text": "Turn views into appointments and long-term patients.",
              "value": "",
              "icon": "chart"
            },
            {
              "title": "Chiropractic Video Templates",
              "text": "Ready-to-use videos for back pain, posture, wellness care, and more.",
              "value": "",
              "icon": "heart"
            }
          ]
        }
      },
      {
        "type": "Showcase",
        "props": {
          "id": "pd-chiro-action",
          "variant": "split",
          "side": "right",
          "title": "See It In [[Action]]",
          "text": "Watch how chiropractors are using SmartVideo AI to educate patients, fill their schedules, and grow their local practice.",
          "bullets": [
            {
              "text": "New patient welcome videos"
            },
            {
              "text": "Treatment & benefit explainers"
            },
            {
              "text": "Local wellness and prevention tips"
            }
          ],
          "buttonLabel": "Watch the Demo Video",
          "buttonUrl": "#video",
          "image": "/landing-art/pd-chiro/laptop.webp",
          "imageAlt": "The SmartVideo AI editor with a personalized video",
          "background": "",
          "points": []
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pd-chiro-qh",
          "eyebrow": "",
          "title": "Trusted by Chiropractors Across Local Communities",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pd-chiro-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-chiro-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI has been a game-changer for our clinic. We’re getting more local consultation requests every week!",
                    "name": "Dr. Emily Regers, DC",
                    "role": "Rogers Chiropractic & Wellness",
                    "avatar": "/landing-art/pd-chiro/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-chiro-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The personalized videos help us educate new patients and build trust before they even walk in. Our schedule is fuller than ever.",
                    "name": "Dr. Jason Miller, DC",
                    "role": "Miller Family Chiropractic",
                    "avatar": "/landing-art/pd-chiro/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pd-chiro-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Easy to use, professional results, and real growth for our practice. We’ve seen a noticeable increase in local patient bookings.",
                    "name": "Dr. Laura Chen, DC",
                    "role": "Chen Chiropractic Care",
                    "avatar": "/landing-art/pd-chiro/avatar3.webp"
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
          "id": "pd-chiro-cta",
          "variant": "band",
          "side": "right",
          "title": "Ready to Grow Your Chiropractic Practice?",
          "text": "Start creating personalized videos that attract more local patients, book more consultations, and keep your community moving, feeling, and living better.",
          "bullets": [],
          "buttonLabel": "Get Started Free",
          "buttonUrl": "#lead",
          "image": "",
          "imageAlt": "",
          "background": "/landing-art/pd-chiro/band.webp",
          "points": [
            {
              "text": "Free to try"
            },
            {
              "text": "No credit card required"
            },
            {
              "text": "Quick setup"
            },
            {
              "text": "Start getting leads today"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
