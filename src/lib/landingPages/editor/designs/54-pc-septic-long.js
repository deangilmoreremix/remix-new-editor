/** Generated from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "editable-pc-septic-long",
  "name": "Septic pumping: full landing page",
  "description": "One-screen industry page: video card and headline, four benefit tiles, a lead form band, three testimonials and a closing button bar. Names, quotes and offers are sample content. Tokens: {{firstname}}, {{custom1}} (city), {{custom2}} (pet owner).",
  "designClass": "pc-septic-long",
  "sampleTypes": [
    "QuoteCard"
  ],
  "theme": {
    "mode": "dark",
    "accent": "#ff8a1f",
    "highlight": "#ff8a1f",
    "bg": "#06122b",
    "text": "#ffffff",
    "font": "system"
  },
  "layout": "editable",
  "editable": true,
  "radius": 18,
  "editorData": {
    "root": {
      "props": {
        "design": "pc-septic-long",
        "accent": "#ff8a1f",
        "background": "#06122b",
        "text": "#ffffff",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "pc-septic-long-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/pc-septic-long/logo.webp",
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
              "label": "For Service Businesses",
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
          "id": "pc-septic-long-hero",
          "variant": "video-copy-form",
          "background": "",
          "eyebrow": "A Personalized Video for {{firstname|you}}",
          "headline": "{{firstname|there}}, Keep Your\nHome Safer, Healthier, and\nHassle-Free with Professional\n[[Septic Pumping & Inspections from ClearFlow Septic]]",
          "subhead": "I created a quick, personalized video just for you to show how ClearFlow Septic helps local homeowners like you avoid costly backups, stay compliant, and keep your septic system running right with pumping, inspections, emergency service, and maintenance plans.",
          "bullets": [],
          "buttons": [
            {
              "label": "Watch Your Personalized Video",
              "url": "#video",
              "style": "primary"
            },
            {
              "label": "Or Schedule a Free Septic Consultation",
              "url": "#lead",
              "style": "secondary"
            }
          ],
          "chip": "",
          "photo": "/landing-art/pc-septic-long/poster.webp",
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
          "id": "pc-septic-long-tiles",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Reliable Local Service",
              "text": "Fast, friendly, and professional septic care",
              "value": "",
              "icon": "car"
            },
            {
              "title": "Prevent Costly Backups",
              "text": "Keep your septic system flowing and your home protected",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Stay Compliant",
              "text": "Inspections and service that meet local requirements",
              "value": "",
              "icon": "calendar"
            },
            {
              "title": "Longer System Life",
              "text": "Routine maintenance for better performance and value",
              "value": "",
              "icon": "leaf"
            },
            {
              "title": "Emergency Response",
              "text": "Fast help for septic backups and urgent issues",
              "value": "",
              "icon": "bolt"
            }
          ]
        }
      },
      {
        "type": "ContactBand",
        "props": {
          "id": "pc-septic-long-form",
          "eyebrow": "",
          "title": "Get a Free Septic Service Quote from ClearFlow Septic",
          "text": "Enter your information below to get a free, no-obligation quote, service recommendation, and septic care tips for your home.",
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
              "key": "zip",
              "label": "Your Zip Code",
              "type": "text",
              "required": false
            }
          ],
          "submitLabel": "Get My Free Septic Quote",
          "successMessage": "Thanks! We will be in touch shortly."
        }
      },
      {
        "type": "Strip",
        "props": {
          "id": "pc-septic-long-services",
          "kind": "benefits",
          "title": "Complete Septic Services for Local Homeowners",
          "items": [
            {
              "title": "Septic Pumping",
              "text": "Keep your tank clean, prevent overflows, and avoid expensive repairs.",
              "value": "",
              "icon": "car",
              "image": "/landing-art/pc-septic-long/svc1.webp"
            },
            {
              "title": "Septic Inspections",
              "text": "Know your system's condition, catch issues early, and stay compliant.",
              "value": "",
              "icon": "check",
              "image": "/landing-art/pc-septic-long/svc2.webp"
            },
            {
              "title": "Emergency Backups",
              "text": "Fast, reliable response for sewage backups, slow drains, and system emergencies.",
              "value": "",
              "icon": "bolt",
              "image": "/landing-art/pc-septic-long/svc3.webp"
            },
            {
              "title": "Maintenance Plans",
              "text": "Scheduled pumping, priority service, and peace of mind all year long.",
              "value": "",
              "icon": "calendar",
              "image": "/landing-art/pc-septic-long/svc4.webp"
            }
          ]
        }
      },
      {
        "type": "TextBlock",
        "props": {
          "id": "pc-septic-long-qh",
          "eyebrow": "",
          "title": "Trusted by Homeowners Across Our Community",
          "text": "",
          "align": "center"
        }
      },
      {
        "type": "Grid",
        "props": {
          "id": "pc-septic-long-quotes",
          "columns": 3,
          "items": [
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-long-quote1",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "ClearFlow was on time, professional, and made the pumping process easy. Our system has never worked better!",
                    "name": "Melissa T., Homeowner, Riverview",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-septic-long/avatar1.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-long-quote2",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "We had a backup over the weekend and they came out fast and got us running again. True lifesavers!",
                    "name": "Darren K., Homeowner, Maple Grove",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-septic-long/avatar2.webp"
                  }
                ]
              }
            },
            {
              "type": "QuoteCard",
              "props": {
                "id": "pc-septic-long-quote3",
                "columns": 1,
                "heading": "",
                "quotes": [
                  {
                    "text": "The inspection was thorough, the explanations were clear, and the maintenance plan gives us real peace of mind.",
                    "name": "Angela M., Homeowner, Lakeside",
                    "role": "★★★★★",
                    "avatar": "/landing-art/pc-septic-long/avatar3.webp"
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
          "id": "pc-septic-long-trust",
          "kind": "benefits",
          "title": "",
          "items": [
            {
              "title": "Proudly Serving Riverview & Surrounding Areas",
              "text": "",
              "value": "",
              "icon": "pin"
            },
            {
              "title": "1,000+",
              "text": "Local Homeowners Served",
              "value": "",
              "icon": "users"
            },
            {
              "title": "4.9/5 Average Rating",
              "text": "(500+ Reviews)",
              "value": "",
              "icon": "star"
            },
            {
              "title": "Licensed, Insured",
              "text": "& Responsible Disposal",
              "value": "",
              "icon": "shield"
            },
            {
              "title": "Eco-Friendly Service",
              "text": "Protecting Our Local Waterways",
              "value": "",
              "icon": "leaf"
            }
          ]
        }
      },
      {
        "type": "CtaBar",
        "props": {
          "id": "pc-septic-long-bar",
          "text": "Ready for a Healthier, Worry-Free Septic System? Get your free quote, schedule a pumping or inspection, or ask about our affordable maintenance plans today.",
          "label": "Get My Free Septic Quote Now",
          "url": "#lead",
          "icon": "calendar"
        }
      }
    ],
    "zones": {}
  }
};
