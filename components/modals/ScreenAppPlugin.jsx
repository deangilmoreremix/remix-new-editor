// ScreenAppPlugin.jsx
import React, { useEffect } from 'react';

const ScreenAppPlugin = ({ onRecordingComplete, handleClose }) => {
  useEffect(() => {
    
    const loadScreenAppScript = () => {
      const script = document.createElement('script');
      script.src = 'https://screenapp.io/app/plugin.js';
      script.charset = 'UTF-8';
      script.type = 'text/javascript';
      script.onload = () => {
        const screenApp = new window.ScreenApp('667de452336ca9be3b3beb51', ({ id, url }) => {
          console.log('Recording completed', { id, url });
          onRecordingComplete({ id, url });
        });
        screenApp.mount('#screenapp-plugin');
      };
      document.body.appendChild(script);
      handleClose()
    };

    loadScreenAppScript();
   
  }, [onRecordingComplete]);

  return <div id="screenapp-plugin" />;
};

export default ScreenAppPlugin;
