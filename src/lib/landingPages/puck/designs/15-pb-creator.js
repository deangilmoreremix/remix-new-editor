/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-creator",
  "name": "Creator: stunning videos",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-creator",
  "theme": {
    "mode": "dark",
    "accent": "#6a4cff",
    "highlight": "#6a4cff",
    "bg": "#1a0b4a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-creator",
        "accent": "#6a4cff",
        "background": "#1a0b4a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-creator-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-creator/logo.webp",
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
          "id": "pb-creator-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Design stunning, personalized videos for any audience.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-creator/poster.webp",
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
          "submitLabel": "Start Creating",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-creator-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Stunning Templates",
              "text": "",
              "value": "",
              "icon": "palette"
            },
            {
              "title": "Powerful Tools",
              "text": "",
              "value": "",
              "icon": "bolt"
            },
            {
              "title": "Grow Your Brand",
              "text": "",
              "value": "",
              "icon": "star"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-creator-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-creator-quote",
                "columns": 1,
                "heading": "What Our Creators Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI gives me the creative freedom I need.",
                    "name": "Alex Morgan",
                    "role": "Content Creator",
                    "avatar": "/landing-art/pb-creator/avatar.webp"
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
          "id": "pb-creator-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "more subscribers",
              "text": "",
              "value": "4x",
              "icon": ""
            },
            {
              "title": "watch to the end",
              "text": "",
              "value": "70%",
              "icon": ""
            },
            {
              "title": "views a month",
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
          "id": "pb-creator-why",
          "eyebrow": "What you get",
          "title": "Everything your fans needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-creator-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-creator-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "video",
                    "title": "Videos that feel personal",
                    "text": "Say hello to each fan by name."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-creator-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "users",
                    "title": "Grow your community",
                    "text": "Turn viewers into subscribers."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-creator-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "See what works",
                    "text": "Know who watched and clicked."
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
          "id": "pb-creator-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-creator-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-creator-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Record your intro",
                    "text": "One video, your voice.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add names and shout-outs.",
                    "icon": ""
                  },
                  {
                    "title": "Share the link",
                    "text": "Post it anywhere your fans are.",
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
          "id": "pb-creator-say",
          "eyebrow": "What people say",
          "title": "Loved by fans and followers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-creator-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-creator-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Fans reply with their own videos now.",
                    "name": "Jess M.",
                    "role": "Creator",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-creator-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "My list grew faster than with any other post.",
                    "name": "Kai B.",
                    "role": "Podcaster",
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
          "id": "pb-creator-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-creator-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-creator-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can I use it on social media?",
                    "a": "Yes, share the link anywhere."
                  },
                  {
                    "q": "Do I need an editor?",
                    "a": "No. Upload a video and edit the page."
                  },
                  {
                    "q": "Is it free to try?",
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
          "id": "pb-creator-contact",
          "eyebrow": "Let's talk",
          "title": "Join the community",
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
          "id": "pb-creator-footer",
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
          "id": "pb-creator-bar",
          "text": "Turn your ideas into personalized video experiences.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
