import React from 'react';

import EditorPanel from './thumbnails/EditorPanel/EditorPanel';
import ThumbnailsHeader from './thumbnails/ThumbnailsHeader';
import ThumbnailCanvas from './thumbnails/Canvas/Canvas';

const ThumbnailsEditor = () => (
  <section className="thumbnails-editor">
    <ThumbnailsHeader />
    <div className="thumbnails__body">
      <EditorPanel />
      <div className="thumbnails__body-editor">
        <ThumbnailCanvas />
      </div>
    </div>
  </section>
);

export default ThumbnailsEditor;
