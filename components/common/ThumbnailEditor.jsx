import { Component } from '../base/Component.js';
import EditorPanel from './thumbnails/EditorPanel/EditorPanel';
import ThumbnailsHeader from './thumbnails/ThumbnailsHeader';
import ThumbnailCanvas from './thumbnails/Canvas/Canvas';

class ThumbnailEditor extends Component {
  constructor(props = {}) {
    super(props);
  }

  render() {
    const section = document.createElement('section');
    section.className = 'thumbnail-editor';

    const thumbnailsHeader = new ThumbnailsHeader().render();
    section.appendChild(thumbnailsHeader);

    const body = document.createElement('div');
    body.className = 'thumbnail__body';

    const editorPanel = new EditorPanel().render();
    body.appendChild(editorPanel);

    const bodyEditor = document.createElement('div');
    bodyEditor.className = 'thumbnail__body-editor';

    const thumbnailCanvas = new ThumbnailCanvas().render();
    bodyEditor.appendChild(thumbnailCanvas);

    body.appendChild(bodyEditor);
    section.appendChild(body);

    return section;
  }
}

export default ThumbnailEditor;
