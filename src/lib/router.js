// Simple vanilla JS router
class Router {
  constructor() {
    this.routes = {};
    this.listeners = [];
  }

  // Add a route
  add(path, handler) {
    this.routes[path] = handler;
  }

  // Navigate to a path
  navigate(path) {
    window.history.pushState(null, '', path);
    this.trigger('navigate', path);
  }

  // Go back in history
  back() {
    window.history.back();
  }

  // Go forward in history
  forward() {
    window.history.forward();
  }

  // Listen for route changes
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  // Trigger an event
  trigger(event, data) {
    this.listeners
      .filter(listener => listener.event === event)
      .forEach(listener => listener.callback(data));
  }

  // Initialize the router
  init() {
    // Handle initial load
    this.trigger('navigate', window.location.pathname);

    // Handle link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link && link.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const path = link.getAttribute('href');
        this.navigate(path);
      }
    });
  }
}

// Export singleton instance
const router = new Router();
export default router;