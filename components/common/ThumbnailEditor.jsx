import React from 'react';

import EditorPanel from './thumbnails/EditorPanel/EditorPanel';
import ThumbnailsHeader from './thumbnails/ThumbnailsHeader';
import ThumbnailCanvas from './thumbnails/Canvas/Canvas';

const ThumbnailEditor = () => (
  <section className="thumbnail-editor">
    <ThumbnailsHeader />
    <div className="thumbnail__body">
      <EditorPanel />
      <div className="thumbnail__body-editor">
        <ThumbnailCanvas />
      </div>
    </div>
  </section>
);

export default ThumbnailEditor;
