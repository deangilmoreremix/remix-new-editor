import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

const LandingPage = () => {
  return (
    <>
      <Head>
        <title>Video Personalization Platform - AI-Powered Video Creation</title>
        <meta name="description" content="Create personalized videos at scale with AI avatars, neural TTS, and professional video generation. Sendspark alternative with open-source flexibility." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="landing-page">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <div className="badge">🚀 SmartVideo Integration Complete</div>
            <h1>Create Personalized Videos at Scale</h1>
            <p className="hero-subtitle">
              AI-powered video personalization platform with professional avatars,
              neural text-to-speech, and perfect lip-sync technology.
            </p>
            <p className="hero-description">
              The complete Sendspark alternative with open-source flexibility,
              200+ AI models, and enterprise-grade features.
            </p>

            <div className="hero-buttons">
              <Link href="/personalize">
                <a className="btn-primary">Start Creating Videos</a>
              </Link>
              <Link href="/smartvideo-demo">
                <a className="btn-secondary">View Demo</a>
              </Link>
            </div>

            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-value">200+</span>
                <span className="stat-label">AI Models</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">40+</span>
                <span className="stat-label">Languages</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">100%</span>
                <span className="stat-label">Sendspark Parity</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">10K+</span>
                <span className="stat-label">Contacts/Batch</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="video-preview-card">
              <div className="preview-header">
                <div className="preview-avatar">👨‍💼</div>
                <div className="preview-info">
                  <span className="preview-name">AI Presenter</span>
                  <span className="preview-status">Generating...</span>
                </div>
              </div>
              <div className="preview-content">
                <div className="waveform">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="wave-bar" style={{ height: `${Math.random() * 40 + 10}px` }}></div>
                  ))}
                </div>
                <p className="preview-text">"Hi John, welcome to Acme Corp!"</p>
              </div>
              <div className="preview-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '75%' }}></div>
                </div>
                <span>75% Complete</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2>Two Powerful Creation Modes</h2>
          <p className="section-subtitle">Choose the approach that works best for your needs</p>

          <div className="features-grid">
            <div className="feature-card gradient-purple">
              <div className="feature-icon">🤖</div>
              <h3>AI Video Generation</h3>
              <p>Create professional videos from scratch using AI avatars, neural TTS, and lip-sync technology.</p>
              <ul className="feature-list">
                <li>Script-to-video creation</li>
                <li>AI avatar generation</li>
                <li>Neural text-to-speech</li>
                <li>Perfect lip-sync</li>
                <li>200+ AI models</li>
              </ul>
              <Link href="/personalize">
                <a className="btn-feature">Try AI Generation</a>
              </Link>
            </div>

            <div className="feature-card gradient-blue">
              <div className="feature-icon">🎬</div>
              <h3>Overlay Personalization</h3>
              <p>Upload existing videos and personalize them with dynamic text replacement for each contact.</p>
              <ul className="feature-list">
                <li>Text overlay replacement</li>
                <li>CSV contact import</li>
                <li>Token-based personalization</li>
                <li>Bulk video generation</li>
                <li>Fast processing</li>
              </ul>
              <Link href="/personalize">
                <a className="btn-feature">Try Overlay Mode</a>
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Import Contacts</h3>
              <p>Upload your CSV file with contact information including names, companies, and custom fields.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Configure Content</h3>
              <p>Write your script with personalization tokens like {'{{firstName}}'} or upload a base video template.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Generate Videos</h3>
              <p>AI creates personalized videos for each contact with professional avatars and natural voices.</p>
            </div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Download & Share</h3>
              <p>Download your videos or share them directly via email, social media, or embed codes.</p>
            </div>
          </div>
        </section>

        {/* Integration Status */}
        <section className="integration-section">
          <h2>✅ SmartVideo Integration Complete</h2>
          <p className="section-subtitle">All Sendspark features are now implemented and available</p>

          <div className="integration-grid">
            <div className="integration-category">
              <h3>Core AI Features</h3>
              <ul>
                <li>✅ AI Avatar Generation</li>
                <li>✅ Neural Text-to-Speech</li>
                <li>✅ Lip-Sync Technology</li>
                <li>✅ Script-to-Video Creation</li>
                <li>✅ Dynamic Scene Generation</li>
                <li>✅ Emotional Context Analysis</li>
              </ul>
            </div>

            <div className="integration-category">
              <h3>Advanced Features</h3>
              <ul>
                <li>✅ Voice Cloning (ElevenLabs)</li>
                <li>✅ Multi-language Support (40+)</li>
                <li>✅ AI Video Upscaling</li>
                <li>✅ Professional Color Grading</li>
                <li>✅ Noise Reduction</li>
                <li>✅ Video Stabilization</li>
              </ul>
            </div>

            <div className="integration-category">
              <h3>Infrastructure</h3>
              <ul>
                <li>✅ 200+ AI Models</li>
                <li>✅ Muapi.ai Integration</li>
                <li>✅ Template System</li>
                <li>✅ Upload History</li>
                <li>✅ Cloud Storage</li>
                <li>✅ Help System</li>
              </ul>
            </div>
          </div>

          <div className="parity-status">
            <div className="parity-bar-container">
              <div className="parity-bar">
                <div className="parity-fill" style={{ width: '100%' }}></div>
              </div>
              <span className="parity-text">100% Sendspark Parity Achieved</span>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <h2>Ready to Create Personalized Videos?</h2>
          <p>Start generating professional AI videos for your contacts today.</p>
          <div className="cta-buttons">
            <Link href="/personalize">
              <a className="btn-cta-primary">Get Started Free</a>
            </Link>
            <Link href="/smartvideo-demo">
              <a className="btn-cta-secondary">Explore Features</a>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>© 2024 Video Personalization Platform. Open-source alternative to Sendspark.</p>
          <div className="footer-links">
            <Link href="/personalize"><a>Personalizer</a></Link>
            <Link href="/smartvideo-demo"><a>Demo</a></Link>
            <Link href="/account"><a>Account</a></Link>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: #0f172a;
          color: white;
        }

        /* Hero Section */
        .hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          padding: 80px 60px;
          max-width: 1400px;
          margin: 0 auto;
          align-items: center;
        }

        .badge {
          display: inline-block;
          padding: 8px 16px;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid #3b82f6;
          border-radius: 20px;
          font-size: 14px;
          color: #3b82f6;
          margin-bottom: 24px;
        }

        .hero h1 {
          font-size: 56px;
          font-weight: 800;
          line-height: 1.1;
          margin: 0 0 24px 0;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 20px;
          color: #cbd5e1;
          margin: 0 0 16px 0;
          line-height: 1.5;
        }

        .hero-description {
          font-size: 16px;
          color: #94a3b8;
          margin: 0 0 32px 0;
        }

        .hero-buttons {
          display: flex;
          gap: 16px;
          margin-bottom: 48px;
        }

        .btn-primary, .btn-secondary, .btn-feature, .btn-cta-primary, .btn-cta-secondary {
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          display: inline-block;
          text-align: center;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: transparent;
          color: white;
          border: 1px solid #475569;
        }

        .btn-secondary:hover {
          background: #1e293b;
        }

        .stats-row {
          display: flex;
          gap: 40px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: #3b82f6;
        }

        .stat-label {
          font-size: 14px;
          color: #94a3b8;
        }

        /* Hero Visual */
        .hero-visual {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .video-preview-card {
          background: #1e293b;
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
          border: 1px solid #334155;
        }

        .preview-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .preview-avatar {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .preview-info {
          display: flex;
          flex-direction: column;
        }

        .preview-name {
          font-weight: 600;
        }

        .preview-status {
          font-size: 12px;
          color: #22c55e;
        }

        .preview-content {
          background: #0f172a;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .waveform {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 50px;
          margin-bottom: 12px;
        }

        .wave-bar {
          width: 4px;
          background: #3b82f6;
          border-radius: 2px;
          animation: wave 1s ease-in-out infinite;
        }

        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }

        .preview-text {
          font-size: 14px;
          color: #cbd5e1;
          margin: 0;
        }

        .preview-progress {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-bar {
          flex: 1;
          height: 4px;
          background: #334155;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
          transition: width 0.3s ease;
        }

        .preview-progress span {
          font-size: 12px;
          color: #94a3b8;
        }

        /* Features Section */
        .features-section {
          padding: 80px 60px;
          background: #1e293b;
        }

        .features-section h2 {
          text-align: center;
          font-size: 40px;
          margin: 0 0 16px 0;
        }

        .section-subtitle {
          text-align: center;
          font-size: 18px;
          color: #94a3b8;
          margin-bottom: 48px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .feature-card {
          padding: 40px;
          border-radius: 16px;
          text-align: center;
        }

        .feature-card.gradient-purple {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.05) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .feature-card.gradient-blue {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .feature-card h3 {
          font-size: 24px;
          margin: 0 0 12px 0;
        }

        .feature-card > p {
          font-size: 16px;
          color: #cbd5e1;
          margin: 0 0 20px 0;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
          text-align: left;
        }

        .feature-list li {
          padding: 6px 0;
          padding-left: 20px;
          position: relative;
          font-size: 14px;
        }

        .feature-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #22c55e;
          font-weight: bold;
        }

        /* How It Works */
        .how-it-works {
          padding: 80px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .how-it-works h2 {
          text-align: center;
          font-size: 40px;
          margin: 0 0 48px 0;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        .step-card {
          background: #1e293b;
          padding: 32px;
          border-radius: 12px;
          border: 1px solid #334155;
          text-align: center;
        }

        .step-number {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
          margin: 0 auto 16px auto;
        }

        .step-card h3 {
          font-size: 18px;
          margin: 0 0 12px 0;
        }

        .step-card p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }

        /* Integration Section */
        .integration-section {
          padding: 80px 60px;
          background: #1e293b;
        }

        .integration-section h2 {
          text-align: center;
          font-size: 40px;
          margin: 0 0 16px 0;
        }

        .integration-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          max-width: 1200px;
          margin: 0 auto 48px auto;
        }

        .integration-category {
          background: #0f172a;
          padding: 24px;
          border-radius: 12px;
        }

        .integration-category h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          color: #3b82f6;
        }

        .integration-category ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .integration-category li {
          padding: 6px 0;
          font-size: 14px;
          color: #cbd5e1;
        }

        .parity-status {
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }

        .parity-bar-container {
          background: #0f172a;
          padding: 24px;
          border-radius: 12px;
        }

        .parity-bar {
          width: 100%;
          height: 12px;
          background: #334155;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .parity-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
          transition: width 0.5s ease;
        }

        .parity-text {
          font-size: 16px;
          font-weight: 600;
          color: #22c55e;
        }

        /* CTA Section */
        .cta-section {
          padding: 80px 60px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          text-align: center;
        }

        .cta-section h2 {
          font-size: 40px;
          margin: 0 0 16px 0;
        }

        .cta-section > p {
          font-size: 18px;
          opacity: 0.9;
          margin: 0 0 32px 0;
        }

        .cta-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
        }

        .btn-cta-primary {
          background: white;
          color: #3b82f6;
          padding: 16px 32px;
          font-size: 16px;
        }

        .btn-cta-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        .btn-cta-secondary {
          background: transparent;
          color: white;
          border: 2px solid white;
          padding: 16px 32px;
          font-size: 16px;
        }

        .btn-cta-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        /* Footer */
        .landing-footer {
          padding: 40px 60px;
          background: #0f172a;
          border-top: 1px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .landing-footer p {
          font-size: 14px;
          color: #94a3b8;
          margin: 0;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .footer-links a:hover {
          color: white;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .hero {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .hero-buttons {
            justify-content: center;
          }

          .stats-row {
            justify-content: center;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .steps-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .integration-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .hero {
            padding: 40px 24px;
          }

          .hero h1 {
            font-size: 36px;
          }

          .steps-grid {
            grid-template-columns: 1fr;
          }

          .cta-buttons {
            flex-direction: column;
          }

          .landing-footer {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }
        }
      `}</style>
    </>
  );
};

export default LandingPage;
