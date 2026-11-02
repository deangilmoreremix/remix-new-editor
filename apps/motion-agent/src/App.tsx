import Home from "./app/page";
import GeneratePage from "./app/generate/page";
import CodeExamplesPage from "./app/code-examples/page";
import { useLocation } from "./shims/router";

/** Replaces Next.js file routing: "/", "/generate", "/code-examples" (hash routes). */
export const App = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/generate")) return <GeneratePage />;
  if (pathname.startsWith("/code-examples")) return <CodeExamplesPage />;
  return <Home />;
};
