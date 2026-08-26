// Landing Page component - vanilla JS version
export default class LandingPage {
  constructor(options = {}) {
    this.performanceService = options.performanceService;
    this.router = options.router;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'landing-page';

    container.innerHTML = `
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-content">
          <div class="badge">🚀 SmartVideo Integration Complete</div>
          <h1>Create Personalized Videos at Scale</h1>
          <p class="hero-subtitle">
            AI-powered video personalization platform with professional avatars,
            neural text-to-speech, and perfect lip-sync technology.
          </p>
          <p class="hero-description">
            The complete Sendspark alternative with AI-powered flexibility,
            200+ AI models, and enterprise-grade features.
          </p>

          <div class="hero-buttons">
            <a href="/editor" class="btn-primary">Start Creating Videos</a>
            <a href="/personalize" class="btn-secondary">Bulk Personalization</a>
            <a href="/smartvideo-demo" class="btn-secondary">View Demo</a>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-value">200+</span>
              <span class="stat-label">AI Models</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">40+</span>
              <span class="stat-label">Languages</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">100%</span>
              <span class="stat-label">Sendspark Parity</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">10K+</span>
              <span class="stat-label">Contacts/Batch</span>
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div class="video-preview-card">
            <div class="preview-header">
              <div class="preview-avatar">👨‍💼</div>
              <div class="preview-info">
                <span class="preview-name">AI Presenter</span>
                <span class="preview-status">Generating...</span>
              </div>
            </div>
            <div class="preview-content">
              <div class="waveform">
                ${[...Array(20)].map((_, i) => `<div class="wave-bar" style="height: ${Math.random() * 40 + 10}px;"></div>`).join('')}
              </div>
              <p class="preview-text">"Hi John, welcome to Acme Corp!"</p>
            </div>
            <div class="preview-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: 75%"></div>
              </div>
              <span>75% Complete</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="features-section">
        <h2>Two Powerful Creation Modes</h2>
        <p class="section-subtitle">Choose the approach that works best for your needs</p>

        <div class="features-grid">
          <div class="feature-card gradient-purple">
            <div class="feature-icon">🤖</div>
            <h3>AI Video Generation</h3>
            <p>Create professional videos from scratch using AI avatars, neural TTS, and lip-sync technology.</p>
            <ul class="feature-list">
              <li>Script-to-video creation</li>
              <li>AI avatar generation</li>
              <li>Neural text-to-speech</li>
              <li>Perfect lip-sync</li>
              <li>200+ AI models</li>
            </ul>
            <a href="/personalize" class="btn-feature">Try AI Generation</a>
          </div>

          <div class="feature-card gradient-blue">
            <div class="feature-icon">🎬</div>
            <h3>Overlay Personalization</h3>
            <p>Upload existing videos and personalize them with dynamic text replacement for each contact.</p>
            <ul class="feature-list">
              <li>Text overlay replacement</li>
              <li>CSV contact import</li>
              <li>Token-based personalization</li>
              <li>Bulk video generation</li>
              <li>Fast processing</li>
            </ul>
            <a href="/personalize" class="btn-feature">Try Overlay Mode</a>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section class="how-it-works">
        <h2>How It Works</h2>
        <div class="steps-grid">
          <div class="step-card">
            <div class="step-number">1</div>
            <h3>Import Contacts</h3>
            <p>Upload your CSV file with contact information including names, companies, and custom fields.</p>
          </div>
          <div class="step-card">
            <div class="step-number">2</div>
            <h3>Configure Content</h3>
            <p>Write your script with personalization tokens like {{firstName}} or upload a base video template.</p>
          </div>
          <div class="step-card">
            <div class="step-number">3</div>
            <h3>Generate Videos</h3>
            <p>AI creates personalized videos for each contact with professional avatars and natural voices.</p>
          </div>
          <div class="step-card">
            <div class="step-number">4</div>
            <h3>Download & Share</h3>
            <p>Download your videos or share them directly via email, social media, or embed codes.</p>
          </div>
        </div>
      </section>

      <!-- CTA Section -->
      <section class="cta-section">
        <h2>Ready to Create Personalized Videos?</h2>
        <p>Start generating professional AI videos for your contacts today.</p>
        <div class="cta-buttons">
          <a href="/personalize" class="btn-cta-primary">Get Started Free</a>
          <a href="/smartvideo-demo" class="btn-cta-secondary">Explore Features</a>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <p>© 2024 Video Personalization Platform. SmartVideo alternative to Sendspark.</p>
        <div class="footer-links">
          <a href="/personalize">Personalizer</a>
            <a href="/smartvideo-demo">Demo</a>
          <a href="/account">Account</a>
        </div>
      </footer>
    `;

    return container;
  }

  afterRender() {
    // Add event listeners for interactive elements
    this.addEventListeners();
  }

  addEventListeners() {
    // Add click handlers for links to use router
    const links = this.container.querySelectorAll('a[href^="/"]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        this.router.navigate(href);
      });
    });
  }

  destroy() {
    // Clean up event listeners if needed
  }
}