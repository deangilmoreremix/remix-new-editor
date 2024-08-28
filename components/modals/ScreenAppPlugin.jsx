import { useEffect } from 'react';

const ScreenAppPlugin = () => {
  useEffect(() => {
    const loadScreenAppScript = () => {
      const script = document.createElement('script');
      script.src = 'https://screenapp.io/app/plugin.js';
      script.charset = 'UTF-8';
      script.type = 'text/javascript';
      script.onload = () => {
        const screenApp = new window.ScreenApp('667de452336ca9be3b3beb51', ({ id, url }) => {
          console.log('Recording completed', { id, url });
        });
        screenApp.mount('#screenapp-plugin');
      };
      document.body.appendChild(script);
    };

    loadScreenAppScript();

    // Cleanup to remove the script if component unmounts
    return () => {
      const existingScript = document.querySelector('script[src="https://screenapp.io/app/plugin.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return <div id="screenapp-plugin" style={{ height: '100%', width: '100%' }}></div>;
};

export default ScreenAppPlugin;
