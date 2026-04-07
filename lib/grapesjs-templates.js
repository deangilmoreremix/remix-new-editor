// GrapesJS Templates for Landing Pages
export const GRAPESJS_TEMPLATES = {
  // Sales-focused templates
  'sales-introduction': {
    name: 'Sales Introduction',
    category: 'Sales',
    description: 'Professional template for sales outreach',
    thumbnail: '🏢',
    html: `
      <div class="container" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <header class="hero-section" style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 32px;">Personal Message</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Just for you, {{firstName}}!</p>
        </header>

        <div class="video-section" style="text-align: center; margin-bottom: 30px;">
          <video controls poster="{{thumbnail}}" style="width: 100%; max-width: 500px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <source src="{{videoUrl}}" type="video/mp4">
          </video>
        </div>

        <div class="message-section" style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
          <h2 style="margin-top: 0; color: #333;">Hi {{firstName}} from {{company}}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 20px;">
            I wanted to personally reach out about how we can help {{company}} achieve better results in {{industry}}.
          </p>
        </div>

        <div class="cta-section" style="text-align: center; margin-bottom: 30px;">
          <a href="https://calendly.com" class="cta-button" style="display: inline-block; padding: 15px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 8px rgba(0,123,255,0.3);">
            Schedule a Call
          </a>
        </div>

        <div class="contact-section" style="background: white; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="margin-top: 0; text-align: center;">About {{company}}</h3>
          <div style="display: flex; justify-content: space-around; text-align: center;">
            <div>
              <div style="font-weight: bold;">{{firstName}} {{lastName}}</div>
              <div style="color: #666; font-size: 14px;">{{title}}</div>
            </div>
            <div>
              <div style="font-weight: bold;">{{company}}</div>
              <div style="color: #666; font-size: 14px;">{{industry}} Industry</div>
            </div>
          </div>
        </div>

        <footer class="footer" style="text-align: center; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>This personalized video was created specifically for {{firstName}} at {{company}}</p>
        </footer>
      </div>
    `,
    css: `
      .container {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .hero-section {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .video-section video {
        width: 100%;
        max-width: 500px;
      }

      .message-section {
        background: #f8f9fa;
      }

      .cta-button {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,123,255,0.4);
      }

      .contact-section {
        border: 1px solid #e0e0e0;
      }

      @media (max-width: 600px) {
        .container {
          padding: 10px;
        }

        .hero-section {
          padding: 30px 15px;
        }

        .hero-section h1 {
          font-size: 28px;
        }

        .message-section {
          padding: 20px;
        }

        .contact-section div {
          margin-bottom: 15px;
        }
      }
    `
  },

  'product-demo': {
    name: 'Product Demo',
    category: 'Marketing',
    description: 'Showcase your product with personalized demo',
    thumbnail: '🚀',
    html: `
      <div class="demo-container" style="font-family: 'Inter', sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <header class="demo-header" style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #2d3748; margin: 0; font-size: 36px;">Exclusive Demo</h1>
          <p style="color: #718096; font-size: 18px; margin: 10px 0 0 0;">Personalized for {{firstName}} at {{company}}</p>
        </header>

        <div class="demo-video" style="text-align: center; margin-bottom: 40px;">
          <video controls poster="{{thumbnail}}" style="width: 100%; max-width: 600px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <source src="{{videoUrl}}" type="video/mp4">
          </video>
          <p style="margin-top: 15px; color: #666; font-style: italic;">Watch my personalized demo for {{company}}</p>
        </div>

        <div class="features-section" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; margin-bottom: 40px;">
          <div class="feature-card" style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #2d3748; margin-top: 0;">🎯 Personalized Experience</h3>
            <p style="color: #718096; line-height: 1.6;">This demo was tailored specifically for {{company}}'s needs in the {{industry}} industry.</p>
          </div>

          <div class="feature-card" style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #2d3748; margin-top: 0;">⚡ Quick Implementation</h3>
            <p style="color: #718096; line-height: 1.6;">Get started in days, not months. Our team handles everything.</p>
          </div>

          <div class="feature-card" style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #2d3748; margin-top: 0;">📈 Measurable Results</h3>
            <p style="color: #718096; line-height: 1.6;">Track ROI and see real improvements in your key metrics.</p>
          </div>
        </div>

        <div class="testimonials" style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 40px; text-align: center;">
          <blockquote style="font-style: italic; color: #666; font-size: 18px; margin: 0;">
            "The personalized approach made all the difference in our decision-making process."
          </blockquote>
          <cite style="display: block; margin-top: 15px; color: #999;">- Previous {{industry}} Client</cite>
        </div>

        <div class="cta-section" style="text-align: center;">
          <h2 style="color: #2d3748; margin-bottom: 20px;">Ready to Get Started?</h2>
          <a href="https://calendly.com/demo" class="demo-cta" style="display: inline-block; padding: 18px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 18px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
            Book Your Demo
          </a>
          <p style="margin-top: 15px; color: #666;">No commitment • 30-minute call • Custom strategy</p>
        </div>
      </div>
    `,
    css: `
      .demo-container {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .demo-header h1 {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .demo-video video {
        border-radius: 12px;
      }

      .features-section {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 30px;
      }

      .feature-card {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
      }

      .demo-cta {
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .demo-cta:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
      }

      @media (max-width: 768px) {
        .demo-container {
          padding: 15px;
        }

        .demo-header h1 {
          font-size: 28px;
        }

        .features-section {
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .feature-card {
          padding: 20px;
        }

        .demo-cta {
          padding: 15px 30px;
          font-size: 16px;
        }
      }
    `
  },

  'follow-up': {
    name: 'Follow-Up Sequence',
    category: 'Sales',
    description: 'Nurture leads with personalized follow-ups',
    thumbnail: '🔄',
    html: `
      <div class="followup-container" style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <header class="followup-header" style="text-align: center; margin-bottom: 30px;">
          <div class="header-badge" style="display: inline-block; background: #e3f2fd; color: #1976d2; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; margin-bottom: 15px;">
            Follow-Up #2
          </div>
          <h1 style="color: #2d3748; margin: 0; font-size: 28px;">Checking In</h1>
          <p style="color: #718096; margin: 10px 0 0 0;">Following up on our conversation about {{company}}</p>
        </header>

        <div class="video-section" style="text-align: center; margin-bottom: 30px;">
          <video controls poster="{{thumbnail}}" style="width: 100%; max-width: 480px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <source src="{{videoUrl}}" type="video/mp4">
          </video>
          <p style="margin-top: 12px; color: #666; font-size: 14px;">2-minute personalized update</p>
        </div>

        <div class="content-section" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
          <h2 style="color: #2d3748; margin-top: 0; text-align: center;">Hi {{firstName}},</h2>

          <p style="color: #4a5568; line-height: 1.7; margin-bottom: 20px;">
            I wanted to follow up on our previous conversation. I know {{company}} is focused on growth in the {{industry}} space, and I believe we can help accelerate that journey.
          </p>

          <div class="value-props" style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #2d3748;">Quick Wins We Could Deliver:</h3>
            <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">30% improvement in key metrics within 90 days</li>
              <li style="margin-bottom: 8px;">Dedicated success manager for {{company}}</li>
              <li style="margin-bottom: 8px;">Custom implementation plan</li>
              <li>ROI tracking and optimization</li>
            </ul>
          </div>

          <p style="color: #4a5568; line-height: 1.7;">
            I'd love to discuss how this could work specifically for {{company}}. Are you available for a quick 15-minute call this week?
          </p>
        </div>

        <div class="social-proof" style="text-align: center; margin-bottom: 30px;">
          <div class="stats" style="display: flex; justify-content: center; gap: 40px; margin-bottom: 20px;">
            <div class="stat">
              <div style="font-size: 24px; font-weight: bold; color: #2d3748;">500+</div>
              <div style="color: #718096; font-size: 14px;">Happy Clients</div>
            </div>
            <div class="stat">
              <div style="font-size: 24px; font-weight: bold; color: #2d3748;">95%</div>
              <div style="color: #718096; font-size: 14px;">Client Retention</div>
            </div>
            <div class="stat">
              <div style="font-size: 24px; font-weight: bold; color: #2d3748;">24/7</div>
              <div style="color: #718096; font-size: 14px;">Support</div>
            </div>
          </div>
        </div>

        <div class="cta-section" style="text-align: center; margin-bottom: 30px;">
          <a href="https://calendly.com/followup" class="cta-button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
            Let's Chat
          </a>
          <div style="margin-top: 12px;">
            <a href="mailto:{{email}}" style="color: #718096; text-decoration: none; margin-right: 20px;">Reply via Email</a>
            <span style="color: #cbd5e0;">•</span>
            <a href="#" style="color: #718096; text-decoration: none; margin-left: 20px;">View Case Studies</a>
          </div>
        </div>

        <footer class="footer" style="text-align: center; color: #a0aec0; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <p>This follow-up was personalized for {{firstName}} at {{company}}</p>
          <p>Having trouble viewing this? <a href="{{videoUrl}}" style="color: #667eea;">Watch the video directly</a></p>
        </footer>
      </div>
    `,
    css: `
      .followup-container {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #2d3748;
      }

      .followup-header {
        position: relative;
      }

      .header-badge {
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .video-section video {
        border-radius: 8px;
      }

      .content-section {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }

      .value-props {
        background: #f8f9fa;
        border-left: 4px solid #667eea;
      }

      .stats {
        display: flex;
        justify-content: center;
        gap: 40px;
      }

      .stat {
        text-align: center;
      }

      .stat div:first-child {
        font-size: 24px;
        font-weight: bold;
        color: #2d3748;
      }

      .stat div:last-child {
        color: #718096;
        font-size: 14px;
        margin-top: 4px;
      }

      .cta-button {
        transition: all 0.2s;
      }

      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      }

      @media (max-width: 600px) {
        .followup-container {
          padding: 15px;
        }

        .followup-header h1 {
          font-size: 24px;
        }

        .stats {
          flex-direction: column;
          gap: 20px;
        }

        .content-section {
          padding: 20px;
        }

        .value-props {
          padding: 15px;
        }
      }
    `
  },

  'minimal-professional': {
    name: 'Minimal Professional',
    category: 'General',
    description: 'Clean, minimal design for professional outreach',
    thumbnail: '✨',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Personal Message</title>
      </head>
      <body style="margin: 0; padding: 20px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafbfc; color: #333;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <div style="padding: 40px 30px 20px; text-align: center; border-bottom: 1px solid #f1f3f4;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">Personal Message</h1>
            <p style="margin: 8px 0 0 0; color: #666; font-size: 16px;">From your connection</p>
          </div>

          <!-- Video Section -->
          <div style="padding: 30px;">
            <video controls poster="{{thumbnail}}" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <source src="{{videoUrl}}" type="video/mp4">
            </video>
          </div>

          <!-- Content -->
          <div style="padding: 0 30px 30px;">
            <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #1a1a1a;">Hi {{firstName}},</h2>
              <p style="margin: 0; line-height: 1.6; color: #555;">
                I recorded this short video specifically for {{company}}. I thought you might find it relevant to your work in {{industry}}.
              </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center;">
              <a href="https://calendly.com" style="display: inline-block; padding: 14px 28px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; transition: background 0.2s;">
                Reply or Schedule Call
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background: #f8f9fa; border-top: 1px solid #f1f3f4; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              Personalized for {{firstName}} • {{company}}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    css: `
      body {
        margin: 0;
        padding: 20px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #fafbfc;
        color: #333;
      }

      .container {
        max-width: 500px;
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      }

      .header {
        padding: 40px 30px 20px;
        text-align: center;
        border-bottom: 1px solid #f1f3f4;
      }

      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .header p {
        margin: 8px 0 0 0;
        color: #666;
        font-size: 16px;
      }

      .video-section {
        padding: 30px;
      }

      .video-section video {
        width: 100%;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

      .content {
        padding: 0 30px 30px;
      }

      .message {
        background: #f8f9fa;
        padding: 24px;
        border-radius: 8px;
        margin-bottom: 24px;
      }

      .message h2 {
        margin: 0 0 12px 0;
        font-size: 18px;
        color: #1a1a1a;
      }

      .message p {
        margin: 0;
        line-height: 1.6;
        color: #555;
      }

      .cta-section {
        text-align: center;
      }

      .cta-button {
        display: inline-block;
        padding: 14px 28px;
        background: #0066cc;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 500;
        font-size: 16px;
        transition: background 0.2s;
      }

      .cta-button:hover {
        background: #0052a3;
      }

      .footer {
        padding: 20px 30px;
        background: #f8f9fa;
        border-top: 1px solid #f1f3f4;
        text-align: center;
      }

      .footer p {
        margin: 0;
        font-size: 14px;
        color: #666;
      }

      @media (max-width: 600px) {
        body {
          padding: 10px;
        }

        .container {
          border-radius: 8px;
        }

        .header {
          padding: 30px 20px 15px;
        }

        .header h1 {
          font-size: 20px;
        }

        .video-section {
          padding: 20px;
        }

        .content {
          padding: 0 20px 20px;
        }

        .message {
          padding: 18px;
        }

        .footer {
          padding: 15px 20px;
        }
      }
    `
  }
};

export default GRAPESJS_TEMPLATES;