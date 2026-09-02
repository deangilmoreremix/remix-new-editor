import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';
import classnames from 'classnames';
import { editorStyles } from '../../lib/constants/editorStyles.js';
import { DEFAULT_TABS, CUSTOM_TABS } from '../../lib/constants/settings.js';
import { BASIC, POPCORN_ELEMENT_TYPES, TEXT_TAB } from '../../lib/constants/popcorn.js';
import SettingsHeader from '../settings/SettingsHeader.js';
import SettingsContainer from '../settings/SettingsContainer.js';

export class SettingsEditor extends Component {
  constructor(props = {}) {
    super(props);
    this.uiStore = getStore('uiStore');
    this.projectStore = getStore('projectStore');
    this.timelineStore = getStore('timelineStore');

    this.state = {
      activeTab: 0,
    };

    this.closeWindow = this.closeWindow.bind(this);
    this.setTab = this.setTab.bind(this);
  }

  onMount() {
    this.subscribeToStore(this.uiStore, () => this.forceUpdate());
    this.subscribeToStore(this.projectStore, () => this.forceUpdate());
    this.subscribeToStore(this.timelineStore, () => this.forceUpdate());
  }

  closeWindow() {
    this.uiStore.setState({ rightBlockVisible: false });
    this.projectStore.getState().releaseElement();
  }

  setTab(tabIndex) {
    this.setState({ activeTab: tabIndex });
  }

  render() {
    const projectState = this.projectStore.getState();
    const { element, retarget, activeElementId } = projectState;
    const timelineState = this.timelineStore.getState();
    const { timelineHeight } = timelineState;

    let currentElement = element;
    if (retarget) {
      if (retarget.id !== activeElementId) {
        currentElement = element;
      } else {
        retarget.additionalType = retarget.kind;
        currentElement = retarget;
      }
    }

    if (!currentElement) {
      return null;
    }

    const { additionalType, type } = currentElement;

    let tabs = [];
    if (type === POPCORN_ELEMENT_TYPES.COMBINED) {
      const combinedTabs = [{ label: BASIC }];
      const combinedTextItems = currentElement.popcornOptions.items.filter(combinedItem => (
        combinedItem.type === POPCORN_ELEMENT_TYPES.TEXT
      ));

      combinedTextItems.forEach((combinedItem, i) => {
        if (combinedTextItems.length < 2) {
          combinedTabs.push({ label: TEXT_TAB });
        } else {
          combinedTabs.push({ label: `${TEXT_TAB}${i + 1}` });
        }
      });

      tabs = combinedTabs;
    } else {
      tabs = CUSTOM_TABS[additionalType || type] || DEFAULT_TABS;
    }

    tabs = tabs.filter(tab => !tab.disabled);

    const editorHeight = editorStyles.calculateHeight(timelineHeight);

    const html = `
      <div class="base-editor" style="height: ${editorHeight}px;">
        <div class="settings-header-placeholder"></div>
        ${tabs[this.state.activeTab] ? `
          <div class="base-editor-elements">
            <div class="settings-container-placeholder"></div>
          </div>
        ` : ''}
      </div>
    `;

    const elementDiv = this.createElementFromHTML(html);
    this.setupEventListeners(elementDiv);
    return elementDiv;
  }

  setupEventListeners(element) {
    const headerPlaceholder = element.querySelector('.settings-header-placeholder');
    if (headerPlaceholder) {
      const projectState = this.projectStore.getState();
      const { element, retarget, activeElementId } = projectState;
      let currentElement = element;
      if (retarget) {
        if (retarget.id !== activeElementId) {
          currentElement = element;
        } else {
          retarget.additionalType = retarget.kind;
          currentElement = retarget;
        }
      }
      const { additionalType, type } = currentElement;

      let tabs = [];
      if (type === POPCORN_ELEMENT_TYPES.COMBINED) {
        const combinedTabs = [{ label: BASIC }];
        const combinedTextItems = currentElement.popcornOptions.items.filter(combinedItem => (
          combinedItem.type === POPCORN_ELEMENT_TYPES.TEXT
        ));

        combinedTextItems.forEach((combinedItem, i) => {
          if (combinedTextItems.length < 2) {
            combinedTabs.push({ label: TEXT_TAB });
          } else {
            combinedTabs.push({ label: `${TEXT_TAB}${i + 1}` });
          }
        });

        tabs = combinedTabs;
      } else {
        tabs = CUSTOM_TABS[additionalType || type] || DEFAULT_TABS;
      }

      tabs = tabs.filter(tab => !tab.disabled);

      const header = new SettingsHeader({
        onCloseWindow: this.closeWindow,
        tabs,
        setTab: this.setTab,
        activeTab: this.state.activeTab
      });
      headerPlaceholder.parentNode.replaceChild(header.render(), headerPlaceholder);
    }

    const containerPlaceholder = element.querySelector('.settings-container-placeholder');
    if (containerPlaceholder) {
      const projectState = this.projectStore.getState();
      const { element, retarget, activeElementId } = projectState;
      let currentElement = element;
      if (retarget) {
        if (retarget.id !== activeElementId) {
          currentElement = element;
        } else {
          retarget.additionalType = retarget.kind;
          currentElement = retarget;
        }
      }
      const { additionalType, type } = currentElement;

      let tabs = [];
      if (type === POPCORN_ELEMENT_TYPES.COMBINED) {
        const combinedTabs = [{ label: BASIC }];
        const combinedTextItems = currentElement.popcornOptions.items.filter(combinedItem => (
          combinedItem.type === POPCORN_ELEMENT_TYPES.TEXT
        ));

        combinedTextItems.forEach((combinedItem, i) => {
          if (combinedTextItems.length < 2) {
            combinedTabs.push({ label: TEXT_TAB });
          } else {
            combinedTabs.push({ label: `${TEXT_TAB}${i + 1}` });
          }
        });

        tabs = combinedTabs;
      } else {
        tabs = CUSTOM_TABS[additionalType || type] || DEFAULT_TABS;
      }

      tabs = tabs.filter(tab => !tab.disabled);

      const container = new SettingsContainer({
        tab: tabs[this.state.activeTab].label,
        handleClose: () => this.uiStore.getState().closeSecondaryWindow(),
        element: currentElement
      });
      containerPlaceholder.parentNode.replaceChild(container.render(), containerPlaceholder);
    }
  }
}

export default SettingsEditor;