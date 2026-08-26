// Dedicated optimizeDeps entry. Importing the auth-critical deps here lets
// Vite's dependency scanner pre-bundle them in a single, stable pass without
// walking the legacy component tree (whose stale named-export imports break
// the full index.html scan and cause the dev optimizer to thrash — which
// served a second React copy to @clerk/react and disabled the sign-in buttons).
import 'react';
import 'react-dom';
import 'react/jsx-runtime';
import '@clerk/react';
