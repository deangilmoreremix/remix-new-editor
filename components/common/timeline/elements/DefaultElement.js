import { Component } from '../../../../base/Component.js';
import { getStore } from '../../../../stores/base/Store.js';
import { POPCORN_ELEMENT_LABELS } from '../../../../lib/constants/popcorn';
import { wrapTokens } from '../../../../lib/utils/tokens-helper';

/**
 * Enhanced DefaultElement with timeline store integration
 * Basic element rendering with store synchronization
 */
export class DefaultElement extends Component {
  constructor(props = {}) {
    super(props);
    this.timelineStore = getStore('timelineStore');

    this.state = {
      item: props.item,
      elementId: props.item?.id || props.item?.i,
    };

    this.syncWithTimelineStore = this.syncWithTimelineStore.bind(this);
    this.handleStoreUpdate = this.handleStoreUpdate.bind(this);
  }

  componentDidMount() {
    // Sync with timeline store on mount
    this.syncWithTimelineStore();
    
    // Subscribe to timeline store updates
    if (this.timelineStore?.subscribe) {
      this.unsubscribeFromStore = this.timelineStore.subscribe((state) => {
        this.handleStoreUpdate(state);
      });
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
  }

  /**
   * Sync element state with timeline store
   */
  syncWithTimelineStore() {
    const { item, elementId } = this.state;
    if (elementId && this.timelineStore?.syncElementState) {
      this.timelineStore.syncElementState({
        id: elementId,
        ...item,
      });
    }
  }

  /**
   * Handle updates from timeline store
   */
  handleStoreUpdate(storeState) {
    const { elementId } = this.state;
    if (!elementId || !this.timelineStore?.getElementState) return;
    
    const elementState = this.timelineStore.getElementState(elementId);
    if (elementState) {
      this.handleElementStateUpdate(elementState);
    }
  }

  /**
   * Handle element state updates from store
   */
  handleElementStateUpdate(elementState) {
    const { item } = this.state;
    
    // Update local state with store state
    this.setState({
      item: {
        ...item,
        ...(elementState.properties && {
          ...elementState.properties,
        }),
      },
    });
  }

  render() {
    const { item } = this.state;

    const html = `
      <div class="popcorn-element" tabindex="-1" title="${item.type || item.title || item.htmlText}" data-element-id="${item.id || item.i}">
        <span class="popcorn-element-name">
          ${item.htmlText ? `<span class="popcorn-element-text" contenteditable="true">${wrapTokens(item.htmlText)}</span>` : POPCORN_ELEMENT_LABELS[item.type]}
        </span>
      </div>
    `;

    return this.createElementFromHTML(html);
  }
}

export default DefaultElement;
