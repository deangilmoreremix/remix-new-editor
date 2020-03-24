import React from 'react';

import ThumbnailCanvas from './thumbnails/Canvas';

const ThumbnailsEditor = () => (
  <section className="thumbnails-editor">
    <div className="thumbnails__header" />
    <div className="thumbnails__body">
      <div className="thumbnails__body-editor">
        <ThumbnailCanvas />
      </div>
    </div>
  </section>
);

export default ThumbnailsEditor;
