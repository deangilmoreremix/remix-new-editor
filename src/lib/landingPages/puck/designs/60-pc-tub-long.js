/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-tub-long",
  "name": "Bathtub refinishing: full landing page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-tub-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#19e8ff",
    "highlight": "#19e8ff",
    "bg": "#06142a",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-tub-long",
        "accent": "#19e8ff",
        "background": "#06142a",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-tub-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-tub-long/logo.webp",
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
              "label": "Examples",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            },
            {
              "label": "Industries",
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
          "id": "pc-tub-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Give Your\nBathtub a [[Like-New Look]]\nfor a Fraction of the Cost",
          "subhead": "I created a short, personalized video just for you to show how we can refinish your bathtub quickly, affordably, and with a beautiful, durable finish.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-tub-long/poster.webp",
          "showForm": "no",
          "slotImage": "",
          "slotVideo": "",
          "bakedPlay": "yes",
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
          "id": "pc-tub-long-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Like-New Results",
              "text": "Restore the beauty of your tub without a full replacement",
              "value": "",
              "icon": "sparkles"
            },
            {
              "title": "Save Money",
              "text": "Get a fresh, durable finish for a fraction of the cost",
              "value": "",
              "icon": "tag"
            },
            {
              "title": "Fast & Convenient",
              "text": "Most tubs refinished in just one day",
              "value": "",
              "icon": "clock"
            },
            {
              "title": "Eco-Friendly",
              "text": "A smart, sustainable way to extend its life",
              "value": "",
              "icon": "leaf"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-tub-long-form",
          "eyebrow": "",
          "title": "Get Your Free Estimate",
          "text": "Enter your information below and I'll send you a personalized video, pricing and available dates.",
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
              "label": "Phone Number",
              "type": "tel",
              "required": false
            },
            {
              "key": "zip",
              "label": "ZIP Code",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Estimate",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-tub-long-brand-g",
          "columns": 1,
          "items": [
            {
              "type": "ChecklistCard",
              "props": {
                "id": "pc-tub-long-brand",
                "columns": 1,
                "title": "FreshCoat Tub Refinishing",
                "text": "",
                "items": [
                  {
                    "label": "Restore Your Tub's Beauty",
                    "value": ""
                  },
                  {
                    "label": "Save 50–75% vs. Replacement",
                    "value": ""
                  },
                  {
                    "label": "Durable, Long-Lasting Finish",
                    "value": ""
                  },
                  {
                    "label": "Dozens of Color Options",
                    "value": ""
                  },
                  {
                    "label": "Fast 1-Day Service",
                    "value": ""
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
          "id": "pc-tub-long-diff",
          "eyebrow": "",
          "title": "See the Difference",
          "text": "Real bathtub refinishing results from local homeowners.",
          "align": "center"
        }
      },
      {
        "type": "PageImage",
        "props": {
          "id": "pc-tub-long-gallery",
          "src": "/landing-art/pc-tub-long/gallery.webp",
          "alt": "Three before and after bathtub refinishing results",
          "rounded": "yes"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-tub-long-how-g",
          "columns": 1,
          "items": [
            {
              "type": "StepsCard",
              "props": {
                "id": "pc-tub-long-how",
                "columns": 1,
                "title": "How It Works",
                "layout": "row",
                "items": [
                  {
                    "title": "Watch Your Video",
                    "text": "See your custom tub refinishing plan",
                    "icon": "video"
                  },
                  {
                    "title": "Schedule a Time",
                    "text": "Pick a date that works for you",
                    "icon": "calendar"
                  },
                  {
                    "title": "We Refinish Your Tub",
                    "text": "Our expert team restores your tub on-site",
                    "icon": "sparkles"
                  },
                  {
                    "title": "Enjoy the Results",
                    "text": "A beautiful, durable finish that looks brand new",
                    "icon": "check"
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
          "id": "pc-tub-long-qh",
          "eyebrow": "",
          "title": "What Homeowners Are Saying",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-tub-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-tub-long-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "I can't believe it's the same tub! It looks brand new and saved me thousands!",
                    "name": "Michelle R. – Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-tub-long/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-tub-long-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Fast, professional and the results are amazing. Highly recommend!",
                    "name": "James T. – Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-tub-long/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-tub-long-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The whole process was easy and so much more affordable than replacing my tub.",
                    "name": "Lisa M. – Homeowner",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-tub-long/avatar3.webp"
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
          "id": "pc-tub-long-bar",
          "text": "Ready to Restore Your Bathtub? Get your personalized video, pricing and a free estimate today.",
          "label": "Watch My Personalized Video Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
