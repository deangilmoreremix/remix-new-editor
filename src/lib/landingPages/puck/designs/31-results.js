/** Converted from the supplied design; all copy is sample content and editable in the studio. */
export default {
  "id": "puck-results",
  "name": "Results page (laptop demo)",
  "description": "Hero with presenter photo and video card, feature tiles, laptop demo, testimonials and a closing CTA band. Names and quotes are sample content.",
  "designClass": "results",
  "theme": {
    "mode": "light",
    "accent": "#1565f2",
    "highlight": "#f5a81c",
    "bg": "#f2f6fd",
    "text": "#0b1a3d",
    "font": "system"
  },
  "layout": "puck",
  "puck": true,
  "radius": 14,
  "puckData": {
    "root": {
      "props": {
        "design": "results",
        "accent": "#1565f2",
        "background": "#f2f6fd",
        "text": "#0b1a3d",
        "surface": ""
      }
    },
    "content": [
      {
        "type": "NavBar",
        "props": {
          "id": "results-nav",
          "brand": "SmartVideo AI",
          "logo": "/landing-art/results/logo.webp",
          "links": [
            {
              "label": "Features",
              "url": ""
            },
            {
              "label": "Templates",
              "url": ""
            },
            {
              "label": "Resources",
              "url": ""
            },
            {
              "label": "Pricing",
              "url": ""
            }
          ],
          "loginLabel": "",
          "loginUrl": "",
          "ctaLabel": "Get Started Free"
        }
      },
      {
        "type": "Hero",
        "props": {
          "id": "results-hero",
          "variant": "copy-video-form",
          "background": "",
          "eyebrow": "",
          "headline": "Create Personalized\nVideos That Get\n[[Results]]",
          "subhead": "Record once and send a custom video for every prospect. Build your list, grow your business, and increase sales.",
          "bullets": [
            {
              "text": "AI-powered personalization"
            },
            {
              "text": "Easy drag-and-drop editor"
            },
            {
              "text": "Built-in lead capture tools"
            }
          ],
          "buttons": [
            {
              "label": "Start Your Free Account",
              "url": "#lead",
              "style": "primary"
            }
          ],
          "chip": "No credit card required",
          "photo": "/landing-art/results/poster.webp",
          "showForm": "yes",
          "formTitle": "Get your free personalized video",
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
          ]
        }
      },
      {
        "type": "ResultsFeatures",
        "props": {
          "id": "results-results-features",
          "title": "Powerful Features to Grow Your Audience",
          "tiles": [
            {
              "icon": "/landing-art/results/i1.webp",
              "label": "Personalized Video Messages"
            },
            {
              "icon": "/landing-art/results/i2.webp",
              "label": "Lead Capture Forms"
            },
            {
              "icon": "/landing-art/results/i3.webp",
              "label": "Business Automation"
            },
            {
              "icon": "/landing-art/results/i4.webp",
              "label": "Custom Branding & Templates"
            },
            {
              "icon": "/landing-art/results/i5.webp",
              "label": "Instant Sharing & Tracking"
            }
          ]
        }
      },
      {
        "type": "ResultsDemo",
        "props": {
          "id": "results-results-demo",
          "title": "See It In Action",
          "text": "Turn any video into a personalized marketing machine. Add your prospect’s name, company and more — in just minutes.",
          "buttonLabel": "Watch Demo Video",
          "buttonUrl": "#video",
          "image": "/landing-art/results/laptop.webp",
          "imageAlt": "Video editor on a laptop showing a presenter with a personalized greeting",
          "arrow": "/landing-art/results/arrow.webp"
        }
      },
      {
        "type": "ResultsTestimonials",
        "props": {
          "id": "results-results-proof",
          "title": "Trusted by Creators, Businesses and Agencies",
          "quotes": [
            {
              "photo": "/landing-art/results/p1.webp",
              "text": "“SmartVideo AI has completely changed the way I connect with clients.”",
              "name": "Sarah Mitchell",
              "role": "Marketing Consultant",
              "stars": "5"
            },
            {
              "photo": "/landing-art/results/p2.webp",
              "text": "“I created a list of qualified leads in just one afternoon. Amazing!”",
              "name": "David Reynolds",
              "role": "Real Estate Agent",
              "stars": "5"
            },
            {
              "photo": "/landing-art/results/p3.webp",
              "text": "“Simple to use, incredibly powerful. My business has never grown faster.”",
              "name": "Lisa Carter",
              "role": "Small Business Owner",
              "stars": "5"
            }
          ]
        }
      },
      {
        "type": "ResultsCta",
        "props": {
          "id": "results-results-cta",
          "title": "Ready to Grow Your Business?",
          "text": "Join thousands of happy users and start creating personalized videos today.",
          "buttonLabel": "Get Started Free",
          "buttonUrl": "#lead",
          "checks": [
            {
              "label": "Free to try"
            },
            {
              "label": "No credit card required"
            },
            {
              "label": "Start in minutes"
            }
          ]
        }
      }
    ],
    "zones": {}
  }
};
