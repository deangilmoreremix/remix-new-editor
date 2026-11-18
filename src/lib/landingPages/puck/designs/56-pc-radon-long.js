/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-pc-radon-long",
  "name": "Radon mitigation: full landing page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-radon-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#8cff1f",
    "highlight": "#8cff1f",
    "bg": "#04120f",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 18,
  "puckData": {
    "root": {
      "props": {
        "design": "pc-radon-long",
        "accent": "#8cff1f",
        "background": "#04120f",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-radon-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-radon-long/logo.webp",
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
              "label": "Results",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            },
            {
              "label": "For Local Businesses",
              "url": ""
            },
            {
              "label": "Resources",
              "url": ""
            }
          ],
          "loginLabel": "Book a Demo",
          "loginUrl": "#lead",
          "ctaLabel": "Get Started"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "pc-radon-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Breathe\nSafer at Home with\n[[Professional Radon Testing & Mitigation from PureAir Radon Solutions]]",
          "subhead": "I created this quick, personalized video just for you to explain how PureAir Radon Solutions can test your home for radon, design the right mitigation system if needed, and give you cleaner, healthier, and safer indoor air for your family—all with local, trusted service you can count on.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Schedule a Free Radon Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-radon-long/poster.webp",
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
          "id": "pc-radon-long-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Accurate Radon Testing",
              "text": "Know your home's radon level with certified, reliable testing",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Proven Mitigation Systems",
              "text": "Custom-designed, code-compliant systems that effectively reduce radon",
              "value": "",
              "icon": "home"
            },
            {
              "title": "Healthier, Safer Air",
              "text": "Lower radon levels for a healthier home and family",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Protect Your Home's Value",
              "text": "A safer home today and stronger peace of mind for tomorrow",
              "value": "",
              "icon": "home"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-radon-long-form",
          "eyebrow": "",
          "title": "Get a Free Radon Testing & Mitigation Consultation",
          "text": "Enter your information below to get a free radon consultation, personalized recommendations, and a no-obligation quote.",
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
              "label": "Phone (Optional)",
              "type": "tel",
              "required": false
            },
            {
              "key": "address",
              "label": "Property Address (Optional)",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Consultation",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pc-radon-long-why",
          "kind": "benefits",
          "title": "Why Homeowners in Our Community Choose PureAir Radon Solutions",
          "items": [
            {
              "title": "Local & Trusted",
              "text": "A locally owned and operated radon specialist, serving our community with integrity.",
              "value": "",
              "icon": "target"
            },
            {
              "title": "Certified & Experienced",
              "text": "Trained, certified, and focused exclusively on radon testing and mitigation.",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Customized Solutions",
              "text": "Right-sized mitigation systems designed for your home's layout and long-term performance.",
              "value": "",
              "icon": "gear"
            },
            {
              "title": "Ongoing Support",
              "text": "From testing to installation and follow-up, we're with you every step of the way.",
              "value": "",
              "icon": "users"
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-radon-long-qh",
          "eyebrow": "",
          "title": "Trusted by Local Homeowners Like You",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-radon-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-radon-long-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "PureAir made the whole process so easy. Our radon level was high, and they installed a mitigation system quickly. Now we have peace of mind!",
                    "name": "Karen L., Homeowner, Riverton",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-radon-long/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-radon-long-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Professional, knowledgeable, and local. They explained our test results, recommended the right system, and the difference in our air is a big relief.",
                    "name": "Mike T., Homeowner, Meadowville",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-radon-long/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-radon-long-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "Great local team! Testing was quick, their pricing was fair, and our mitigation system works perfectly. I highly recommend PureAir Radon Solutions.",
                    "name": "Stephanie R., Homeowner, Lakewood",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-radon-long/avatar3.webp"
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
          "id": "pc-radon-long-about",
          "kind": "benefits",
          "title": "About Radon: What Every Homeowner Should Know",
          "items": [
            {
              "title": "Radon is a colorless, odorless, naturally occurring gas",
              "text": "that can build up in homes.",
              "value": "",
              "icon": "target"
            },
            {
              "title": "It's a leading cause of lung cancer",
              "text": "among non-smokers.",
              "value": "",
              "icon": "heart"
            },
            {
              "title": "The only way to know your level",
              "text": "is with a professional radon test.",
              "value": "",
              "icon": "check"
            },
            {
              "title": "A radon mitigation system can reduce levels",
              "text": "by up to 99%.",
              "value": "",
              "icon": "home"
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pc-radon-long-bar",
          "text": "Ready for a Safer, Healthier Home? Schedule your free radon consultation today and take the first step toward cleaner indoor air, a lower radon level, and long-term peace of mind for your family.",
          "label": "Schedule My Free Radon Consultation",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
