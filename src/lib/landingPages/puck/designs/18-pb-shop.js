/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pb-shop",
  "name": "Local business: more customers",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-shop",
  "theme": {
    "mode": "light",
    "accent": "#2f9e44",
    "highlight": "#2f9e44",
    "bg": "#f4f2ec",
    "text": "#1d2b21",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "pb-shop",
        "accent": "#2f9e44",
        "background": "#f4f2ec",
        "text": "#1d2b21",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-shop-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-shop/logo.webp",
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
          "id": "pb-shop-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Grow your local business with personalized videos.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-shop/poster.webp",
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
          "submitLabel": "Send My Video",
          "privacy": ""
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pb-shop-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Get More Customers",
              "text": "",
              "value": "",
              "icon": "users"
            },
            {
              "title": "Share Offers",
              "text": "",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Grow Local",
              "text": "",
              "value": "",
              "icon": "pin"
            }
          ]
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-shop-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-shop-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI has brought more customers to my shop.",
                    "name": "Karen Davis",
                    "role": "Small Business Owner",
                    "avatar": "/landing-art/pb-shop/avatar.webp"
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
          "id": "pb-shop-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "more orders",
              "text": "",
              "value": "35%",
              "icon": ""
            },
            {
              "title": "repeat buyers",
              "text": "",
              "value": "2x",
              "icon": ""
            },
            {
              "title": "store rating",
              "text": "",
              "value": "4.8",
              "icon": ""
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pb-shop-why",
          "eyebrow": "What you get",
          "title": "Everything your shoppers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-shop-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-shop-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "tag",
                    "title": "Personal offers",
                    "text": "Send a deal made for each customer."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-shop-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "heart",
                    "title": "Thank-you videos",
                    "text": "Make every order feel special."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-shop-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "chart",
                    "title": "See what sells",
                    "text": "Know who watched and bought."
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
          "id": "pb-shop-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-shop-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-shop-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Record a hello",
                    "text": "Show a product or say thanks.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add the customer name and offer.",
                    "icon": ""
                  },
                  {
                    "title": "Share the link",
                    "text": "Send it by email or text.",
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
          "id": "pb-shop-say",
          "eyebrow": "What people say",
          "title": "Loved by shoppers and customers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-shop-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-shop-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Customers love getting a video with their order.",
                    "name": "Nina W.",
                    "role": "Owner, Bloom Goods",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-shop-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Repeat orders went up in a month.",
                    "name": "Leo C.",
                    "role": "Founder, Daily Shop",
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
          "id": "pb-shop-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-shop-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-shop-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can I link to my store?",
                    "a": "Yes, add a button with your store link."
                  },
                  {
                    "q": "Does it work with email tools?",
                    "a": "Yes. Share the link in any email."
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
          "id": "pb-shop-contact",
          "eyebrow": "Let's talk",
          "title": "Get your offer",
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
          "id": "pb-shop-footer",
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
          "id": "pb-shop-bar",
          "text": "Let's grow your business together.",
          "label": "Get Started",
          "url": "#lead",
          "icon": "home"
        }
      }
    ],
    "zones": {}
  }
};
