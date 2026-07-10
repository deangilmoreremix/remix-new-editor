// Client-side Router - SmartVideo Integration
// SPA routing system for the video personalization platform

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.listeners = [];
    this.init();
  }

  // Initialize router
  init() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      this.navigate(window.location.pathname, false);
    });

    // Handle initial load
    this.navigate(window.location.pathname, false);
  }

  // Add a route
  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  // Navigate to a route
  navigate(path, updateHistory = true) {
    const route = this.findRoute(path);
    if (route) {
      this.currentRoute = route;
      if (updateHistory) {
        window.history.pushState(null, '', path);
      }
      this.notifyListeners(route);
      this.executeRoute(route);
    }
  }

  // Find matching route
  findRoute(path) {
    // Exact match
    if (this.routes[path]) {
      return {
        path: path,
        handler: this.routes[path],
        params: {}
      };
    }

    // Dynamic routes with parameters
    for (const routePath in this.routes) {
      const routeRegex = this.pathToRegex(routePath);
      const match = path.match(routeRegex);

      if (match) {
        const params = this.extractParams(routePath, path);
        return {
          path: routePath,
          handler: this.routes[routePath],
          params: params
        };
      }
    }

    return null;
  }

  // Convert path with parameters to regex
  pathToRegex(path) {
    return new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$');
  }

  // Extract parameters from path
  extractParams(routePath, actualPath) {
    const routeParts = routePath.split('/');
    const pathParts = actualPath.split('/');
    const params = {};

    routeParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = pathParts[index];
      }
    });

    return params;
  }

  // Execute route handler
  executeRoute(route) {
    if (typeof route.handler === 'function') {
      route.handler(route.params);
    }
  }

  // Add listener for route changes
  onRouteChange(listener) {
    this.listeners.push(listener);
  }

  // Remove listener
  offRouteChange(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // Notify listeners of route change
  notifyListeners(route) {
    this.listeners.forEach(listener => {
      listener(route);
    });
  }

  // Get current route
  getCurrentRoute() {
    return this.currentRoute;
  }

  // Get current path
  getCurrentPath() {
    return window.location.pathname;
  }

  // Go back in history
  goBack() {
    window.history.back();
  }

  // Go forward in history
  goForward() {
    window.history.forward();
  }

  // Replace current history entry
  replace(path) {
    window.history.replaceState(null, '', path);
    this.navigate(path, false);
  }
}

// Create singleton router instance
const router = new Router();

// Route definitions for video personalization platform
router.addRoute('/', () => {
  // Home/Dashboard
  renderComponent('home');
});

router.addRoute('/personalize', () => {
  // Main personalization hub
  renderComponent('personalize');
});

router.addRoute('/videos', () => {
  // Video library
  renderComponent('videos');
});

router.addRoute('/videos/:id', (params) => {
  // Individual video view
  renderComponent('video-detail', params);
});

router.addRoute('/settings', () => {
  // Settings page
  renderComponent('settings');
});

router.addRoute('/account', () => {
  // Account page
  renderComponent('account');
});

// Helper function to render components (to be implemented by the app)
function renderComponent(componentName, params = {}) {
  // Dispatch custom event that the app can listen to
  const event = new CustomEvent('route-change', {
    detail: { component: componentName, params: params }
  });
  window.dispatchEvent(event);
}

export default router;
export { Router };