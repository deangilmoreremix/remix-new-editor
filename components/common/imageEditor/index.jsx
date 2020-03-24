import React from 'react';

import EditorPanel from './EditorPanel';

const ImageEditor = () => (
  <div
    className="image-editor"
    style={{ background: '#fff', width: '100%', height: '100%', position: 'fixed', top: '0', left: '0', zIndex: 100 }}
  >
    <EditorPanel />
  </div>
);

export default ImageEditor;
