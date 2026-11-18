/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-eats",
  "name": "Restaurant: invitations",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-eats",
  "theme": {
    "mode": "dark",
    "accent": "#f0701b",
    "highlight": "#f0701b",
    "bg": "#1c100b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-eats",
        "accent": "#f0701b",
        "background": "#1c100b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-eats-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-eats/logo.webp",
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
          "id": "pb-eats-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Turn your video into personalized invitations, offers and more.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-eats/poster.webp",
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
          "submitLabel": "Send Me My Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-eats-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Attract More Guests",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Share Special Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Grow Your Business",
              "text": "",
              "value": "",
              "icon": "chart"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-eats-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-eats-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI has helped us fill more tables and increase our sales.",
                    "name": "Jessica Martinez",
                    "role": "Restaurant Owner",
                    "avatar": "/landing-art/pb-eats/avatar.webp"
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
          "id": "pb-eats-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "repeat visits",
              "text": "",
              "value": "2x",
              "icon": ""
            },
            {
              "title": "more bookings",
              "text": "",
              "value": "38%",
              "icon": ""
            },
            {
              "title": "average rating",
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
          "id": "pb-eats-why",
          "eyebrow": "What you get",
          "title": "Everything your guests needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-eats-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-eats-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "cutlery",
                    "title": "Menu spotlights",
                    "text": "Show tonight's specials in a short video."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-eats-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Easy reservations",
                    "text": "Guests book straight from the page."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-eats-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "heart",
                    "title": "Regulars feel known",
                    "text": "Greet each guest by name."
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
          "id": "pb-eats-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-eats-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-eats-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Film the kitchen",
                    "text": "A quick hello from the chef or owner.",
                    "icon": ""
                  },
                  {
                    "title": "Add the guest name",
                    "text": "Each guest sees a greeting made for them.",
                    "icon": ""
                  },
                  {
                    "title": "Fill more tables",
                    "text": "Guests book with one tap.",
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
          "id": "pb-eats-say",
          "eyebrow": "What people say",
          "title": "Loved by guests and regulars",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-eats-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-eats-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Guests mention the video when they arrive.",
                    "name": "Maria L.",
                    "role": "Owner, Casa Verde",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-eats-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Our Friday bookings went up right away.",
                    "name": "Tom H.",
                    "role": "Manager, Harbor Grill",
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
          "id": "pb-eats-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-eats-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-eats-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can guests book from the page?",
                    "a": "Yes. Add a booking link or the contact form."
                  },
                  {
                    "q": "Does it work on phones?",
                    "a": "Yes, the page is built for phones first."
                  },
                  {
                    "q": "Can I show a menu?",
                    "a": "Yes. Add an image or link to your menu."
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
          "id": "pb-eats-contact",
          "eyebrow": "Let's talk",
          "title": "Reserve your table",
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
          "id": "pb-eats-footer",
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
          "id": "pb-eats-bar",
          "text": "Bring more customers to your restaurant.",
          "label": "Get Started",
          "url": "#lead",
          "icon": ""
        }
      }
    ],
    "zones": {}
  }
};
