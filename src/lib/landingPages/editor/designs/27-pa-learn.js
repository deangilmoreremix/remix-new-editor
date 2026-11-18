/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pa-learn",
  "name": "Education",
  "description": "Phone-first photo-story page with a wide-screen layout. Names, quotes and copy are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pa-learn",
  "theme": {
    "mode": "light",
    "accent": "#b0179a",
    "highlight": "#b0179a",
    "bg": "#f2f6ff",
    "text": "#14224a",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pa-learn",
        "accent": "#b0179a",
        "background": "#f2f6ff",
        "text": "#14224a",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pa-learn-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pa-learn/logo.webp",
          "links": [],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": ""
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pa-learn-hero",
          "variant": "story",
          "background": "/landing-art/pa-learn/hero.webp",
          "eyebrow": "",
          "headline": "Hi {{firstname|Olivia}},\nLearn. Create. Achieve.",
          "subhead": "Get a personalized video about our learning programs.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pa-learn/poster.webp",
          "showForm": "yes",
          "formTitle": "Get Started Today",
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
          "submitLabel": "Learn More",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pa-learn-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Online Courses",
              "text": "",
              "value": "",
              "icon": "book"
            },
            {
              "title": "Expert Instructors",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Get Certified",
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
          "id": "pa-learn-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-learn-quote",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "SmartVideo AI made learning simple and engaging.",
                    "name": "Rachel D.",
                    "role": "",
                    "avatar": "/landing-art/pa-learn/avatar.webp"
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
          "id": "pa-learn-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "courses",
              "text": "",
              "value": "120+",
              "icon": ""
            },
            {
              "title": "learner rating",
              "text": "",
              "value": "4.8",
              "icon": ""
            },
            {
              "title": "graduates",
              "text": "",
              "value": "10k",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pa-learn-why",
          "eyebrow": "What you get",
          "title": "Everything your learners needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-learn-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-learn-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "book",
                    "title": "Online courses",
                    "text": "Learn at your own pace."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-learn-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "users",
                    "title": "Expert instructors",
                    "text": "Real practitioners teach every course."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pa-learn-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "trophy",
                    "title": "Get certified",
                    "text": "Earn a certificate you can share."
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
          "id": "pa-learn-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-learn-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pa-learn-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch your video",
                    "text": "See what you can learn.",
                    "icon": ""
                  },
                  {
                    "title": "Pick a course",
                    "text": "Choose a path that fits.",
                    "icon": ""
                  },
                  {
                    "title": "Get certified",
                    "text": "Finish and share your certificate.",
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
          "id": "pa-learn-say",
          "eyebrow": "What people say",
          "title": "Loved by learners",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-learn-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-learn-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Learning felt simple and engaging.",
                    "name": "Rachel D.",
                    "role": "Learner",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pa-learn-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I changed careers after one course.",
                    "name": "Imran K.",
                    "role": "Graduate",
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
          "id": "pa-learn-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pa-learn-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pa-learn-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Are courses self-paced?",
                    "a": "Yes. Learn when it suits you."
                  },
                  {
                    "q": "Do I get a certificate?",
                    "a": "Sample answer: edit this to match your offer."
                  },
                  {
                    "q": "Is there a free course?",
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
          "id": "pa-learn-contact",
          "eyebrow": "Let's talk",
          "title": "Start learning",
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
          "id": "pa-learn-footer",
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
          "id": "pa-learn-bar",
          "text": "",
          "label": "Explore Our Courses",
          "url": "#lead",
          "icon": "book"
        }
      }
    ],
    "zones": {}
  }
};
