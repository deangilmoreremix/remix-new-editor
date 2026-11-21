/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pb-auto",
  "name": "Auto dealer: more sales",
  "description": "Phone-first page with a wide-screen layout. Names, quotes and figures are sample content. Full landing page: stats, features, steps, testimonials, questions, contact form and footer.",
  "designClass": "pb-auto",
  "theme": {
    "mode": "dark",
    "accent": "#e0242b",
    "highlight": "#e0242b",
    "bg": "#070a12",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 14,
  "editorData": {
    "root": {
      "props": {
        "design": "pb-auto",
        "accent": "#e0242b",
        "background": "#070a12",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pb-auto-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pb-auto/logo.webp",
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
          "id": "pb-auto-hero",
          "variant": "duo",
          "background": "",
          "eyebrow": "",
          "headline": "Create once.\nMake it personal.",
          "subhead": "Turn your video into personalized outreach for more sales.",
          "bullets": [],
          "buttons": [],
          "chip": "",
          "photo": "/landing-art/pb-auto/poster.webp",
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
          "id": "pb-auto-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Generate More Leads",
              "text": "",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Increase Sales",
              "text": "",
              "value": "",
              "icon": "handshake"
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
          "id": "pb-auto-grid",
          "columns": 1,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-auto-quote",
                "columns": 1,
                "heading": "What Our Customers Say",
                "quotes": [
                  {
                    "text": "SmartVideo AI helps me connect with more buyers and close more deals.",
                    "name": "David Parker",
                    "role": "Auto Dealer",
                    "avatar": "/landing-art/pb-auto/avatar.webp"
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
          "id": "pb-auto-stats",
          "kind": "stats",
          "title": "",
          "items": [
            {
              "title": "more test drives",
              "text": "",
              "value": "45%",
              "icon": ""
            },
            {
              "title": "average reply time",
              "text": "",
              "value": "2h",
              "icon": ""
            },
            {
              "title": "dealer rating",
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
          "id": "pb-auto-why",
          "eyebrow": "What you get",
          "title": "Everything your drivers needs, in [[one place]]",
          "text": "Sample copy. Replace it with what you offer.",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-auto-feat",
          "columns": 3,
          "items": [
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-auto-feat-0",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "car",
                    "title": "Vehicle walkarounds",
                    "text": "Show the exact car a shopper asked about."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-auto-feat-1",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "calendar",
                    "title": "Test-drive booking",
                    "text": "Shoppers pick a time on the page."
                  }
                ]
              }
            },
            {
              "type": "FeaturesCard",
              "props": {
                "id": "pb-auto-feat-2",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "icon": "tag",
                    "title": "Offers made personal",
                    "text": "Share a price or trade-in offer by name."
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
          "id": "pb-auto-how",
          "eyebrow": "How it works",
          "title": "Three simple [[steps]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-auto-steps",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pb-auto-steps-card",
                "columns": 1,
                "title": "",
                "layout": "row",
                "items": [
                  {
                    "title": "Film the car",
                    "text": "A quick walkaround or greeting.",
                    "icon": ""
                  },
                  {
                    "title": "Personalize",
                    "text": "Add the shopper name and vehicle.",
                    "icon": ""
                  },
                  {
                    "title": "Book the drive",
                    "text": "They schedule right from the page.",
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
          "id": "pb-auto-say",
          "eyebrow": "What people say",
          "title": "Loved by drivers and shoppers",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-auto-quotes",
          "columns": 2,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-auto-q-0",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Shoppers show up already excited.",
                    "name": "Alex R.",
                    "role": "Sales lead, Metro Motors",
                    "avatar": ""
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pb-auto-q-1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The video closes the gap between a click and a visit.",
                    "name": "Priya S.",
                    "role": "GM, Summit Auto",
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
          "id": "pb-auto-faqh",
          "eyebrow": "Questions",
          "title": "Frequently asked [[questions]]",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pb-auto-faq",
          "columns": 1,
          "items": [
            {
              "type": "FaqCard",
              "props": {
                "id": "pb-auto-faq-card",
                "columns": 1,
                "title": "",
                "items": [
                  {
                    "q": "Can I send it by text?",
                    "a": "Yes, share the link in a text, email or chat."
                  },
                  {
                    "q": "Can I add pricing?",
                    "a": "Yes. Add it to the headline or text."
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
          "id": "pb-auto-contact",
          "eyebrow": "Let's talk",
          "title": "Book a test drive",
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
          "id": "pb-auto-footer",
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
          "id": "pb-auto-bar",
          "text": "Drive more sales with personalized videos.",
          "label": "Get Started",
          "url": "#lead",
          "icon": "car"
        }
      }
    ],
    "zones": {}
  }
};
