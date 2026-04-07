// Main App component - vanilla JS version
import Router from '../lib/router.js';
import LandingPage from './LandingPage.js';
import PersonalizePage from './PersonalizePage.js';
import VideoEditorPage from './VideoEditorPage.js';

export default class App {
  constructor(options = {}) {
    this.performanceService = options.performanceService;
    this.router = options.router || Router;
    this.onComponentsReady = options.onComponentsReady;
    this.currentPage = null;
    this.container = document.getElementById('app');

    this.routes = {
      '/': LandingPage,
      '/personalize': PersonalizePage,
      '/editor': VideoEditorPage,
      '/open-higgsfield-demo': () => this.renderDemoPage(),
    };

    this.initRouter();
  }

  init() {
    this.render();
    this.router.init();
  }

  initRouter() {
    // Handle navigation
    this.router.on('navigate', (path) => {
      this.navigate(path);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.navigate(window.location.pathname);
    });
  }

  navigate(path) {
    const PageComponent = this.routes[path];
    if (PageComponent) {
      if (this.currentPage && typeof this.currentPage.destroy === 'function') {
        this.currentPage.destroy();
      }

      this.currentPage = new PageComponent({
        performanceService: this.performanceService,
        router: this.router,
        onComponentsReady: this.onComponentsReady
      });

      this.render();
    } else {
      // Default to landing page
      this.navigate('/');
    }
  }

  render() {
    if (this.currentPage) {
      this.container.innerHTML = '';
      const pageElement = this.currentPage.render();
      this.container.appendChild(pageElement);
      this.currentPage.afterRender();
    } else {
      // Default to landing page
      this.navigate('/');
    }
  }

  renderDemoPage() {
    const demoDiv = document.createElement('div');
    demoDiv.innerHTML = `
      <div class="demo-page">
        <h1>Open-Higgsfield-AI Integration Demo</h1>
        <p>This demonstrates the complete AI integration for video personalization.</p>
        <div class="demo-content">
          <h2>✅ All Features Implemented</h2>
          <ul>
            <li>AI Avatar Generation</li>
            <li>Neural Text-to-Speech</li>
            <li>Lip-Sync Technology</li>
            <li>Script-to-Video Creation</li>
            <li>Dynamic Scene Generation</li>
            <li>Emotional Context Analysis</li>
          </ul>
          <a href="/" class="btn-primary">Back to Home</a>
        </div>
      </div>
    `;
    return demoDiv;
  }
}