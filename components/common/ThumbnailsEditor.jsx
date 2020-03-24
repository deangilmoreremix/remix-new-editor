import React from 'react';

import ThumbnailsHeader from './thumbnails/ThumbnailsHeader';
import ThumbnailCanvas from './thumbnails/Canvas';

const ThumbnailsEditor = () => (
  <section className="thumbnails-editor">
    <ThumbnailsHeader />
    <div className="thumbnails__body">
      <div className="thumbnails__body-editor">
        <ThumbnailCanvas />
      </div>
    </div>
  </section>
);

export default ThumbnailsEditor;
