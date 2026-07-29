import { Component } from '../../vite-remix-editor/src/components/base/Component.js';
import { getStore } from '../../vite-remix-editor/src/stores/base/Store.js';
import { editorStyles } from '../../lib/constants/editorStyles.js';
import { Content } from '../common/lower-thirds/Content.js';
import { CloseButton } from '../common/CloseButton.js';

export class LowerThirds extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');
    this.timelineStore = getStore('timelineStore');
    this.state = { timelineHeight: 0 };
  }

  onMount() {
    this.subscribeToStore(this.timelineStore, (state) => {
      this.setState({ timelineHeight: state.timelineHeight });
    });
  }

  handleClose = () => {
    this.uiStore.toggleRightBlock(false);
  };

  render() {
    const libraryHeight = editorStyles.calculateHeight(this.state.timelineHeight);
    const container = document.createElement('div');
    container.style.height = `${libraryHeight}px`;
    container.className = 'lower-thirds';

    const flexDiv = document.createElement('div');
    flexDiv.className = 'flex';
    container.appendChild(flexDiv);

    const header = document.createElement('header');
    header.className = 'lower-thirds__header';
    header.textContent = 'Lower Thirds';
    flexDiv.appendChild(header);

    const closeButton = new CloseButton({ onClick: this.handleClose });
    closeButton.mount(flexDiv);

    const body = document.createElement('div');
    body.className = 'lower-thirds__body';
    container.appendChild(body);

    const content = new Content({ className: 'library-cta-items', onSelect: this.handleClose });
    content.mount(body);

    return container;
  }
}

export default LowerThirds;