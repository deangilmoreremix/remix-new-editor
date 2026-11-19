/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-fitness",
  "name": "Fitness",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pa-fitness",
  "theme": {
    "mode": "dark",
    "accent": "#7ed321",
    "highlight": "#7ed321",
    "bg": "#0a0a0a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-fitness",
        "accent": "#7ed321",
        "background": "#0a0a0a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-fitness-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-fitness/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-fitness-hero",
          "variant": "story",
          "background": "/landing-art/pa-fitness/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Chris}},\nGet Fit. Feel Great.",
          "subhead": "Watch your personalized fitness video and start today.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-fitness/poster.webp",
          "showForm": "yes",
          "formTitle": "Start Your Plan",
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
          "submitLabel": "Get Started",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-fitness-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Personalized Workouts",
              "text": "",
              "value": "",
              "icon": "dumbbell"
            },
            {
              "title": "Nutrition Tips",
              "text": "",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "Track Progress",
              "text": "",
              "value": "",
              "icon": "trophy"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-fitness-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-fitness-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI helped me reach my fitness goals.",
                    "name": "Kevin S.",
                    "role": "",
                    "avatar": "/landing-art/pa-fitness/avatar.webp"
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
          "id": "pa-fitness-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "active members",
              "text": "",
              "value": "500+",
              "icon": ""
            },
            {
              "title": "member rating",
              "text": "",
              "value": "4.9",
              "icon": ""
            },
            {
              "title": "weeks to results",
              "text": "",
              "value": "12",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-fitness-why",
          "eyebrow": "What you get",
          "title": "Everything your members needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-fitness-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-fitness-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "dumbbell",
                    "title": "Personalized workouts",
                    "text": "Plans built around your goals."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-fitness-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "heart",
                    "title": "Nutrition tips",
                    "text": "Simple advice you can follow."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-fitness-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "trophy",
                    "title": "Track progress",
                    "text": "See your results week by week."
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
          "id": "pa-fitness-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-fitness-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-fitness-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "Meet your coach.",
                    "icon": ""
                  },
                  {
                    "title": "Start your plan",
                    "text": "Choose your goals.",
                    "icon": ""
                  },
                  {
                    "title": "Track progress",
                    "text": "Celebrate every milestone.",
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
          "id": "pa-fitness-say",
          "eyebrow": "What people say",
          "title": "Loved by members",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-fitness-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-fitness-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The plan finally fit my life.",
                    "name": "Kevin S.",
                    "role": "Member",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-fitness-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I feel stronger every week.",
                    "name": "Tara B.",
                    "role": "Member",
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
          "id": "pa-fitness-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-fitness-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-fitness-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Do I need experience?",
                    "a": "No. Every plan starts where you are."
                  },
                  {
                    "q": "Can I train at home?",
                    "a": "Sample answer: edit this to match your offer."
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
          "id": "pa-fitness-contact",
          "eyebrow": "Let's talk",
          "title": "Start your plan",
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
          "id": "pa-fitness-footer",
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
          "id": "pa-fitness-bar",
          "text": "",
          "label": "Join the Fitness Community",
          "url": "#lead",
          "icon": "users"
        }
      }
    ],
    "zones": {}
  }
};
