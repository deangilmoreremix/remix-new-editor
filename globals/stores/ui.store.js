import { observable, action, reaction } from 'mobx';
import { WINDOW_TYPES, TOOLBARS } from '../../lib/constants/ui';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';

export default class UIStore {
  constructor(props) {
    this.projectStore = props.projectStore;
    reaction(
      () => this.projectStore.activeElementId,
      () => {
        if (this.projectStore.activeElementId && this.projectStore.element
          && Object.values(POPCORN_ELEMENT_TYPES).includes(this.projectStore.element.type)) {
          this.secondaryWindowType = WINDOW_TYPES.SETTING;
        } else if (this.projectStore.activeElementId
          && this.projectStore.retarget
          && this.projectStore.retarget.showedForm) {
          this.secondaryWindowType = WINDOW_TYPES.SETTING;
        } else {
          this.secondaryWindowType = null;
        }
      },
    );
    reaction(
      () => this.projectStore.retarget.showedForm,
      () => {
        if (this.projectStore.retarget.showedForm) {
          this.secondaryWindowType = WINDOW_TYPES.SETTING;
        } else {
          this.secondaryWindowType = null;
        }
      },
    );
  }

  @observable toolbarItem = {
    id: null,
    options: {},
  };

  @observable projectStore = {};

  @observable secondaryWindowType = null;

  @observable wideWindow = false;

  @observable firstWindowType = null;

  @observable hasGuidLines = false;

  @observable updateElementInLibrary = null;

  @action
  setGuideLines = (value = false) => {
    this.hasGuidLines = value;
  };

  @action
  setUpdateElementInLibrary = (value = null) => {
    this.updateElementInLibrary = value;
  };

  @action
  setLibraryType = (type) => {
    this.secondaryWindowType = type;
  };

  @action
  openStickers = (type) => {
    this.secondaryWindowType = type;
  };

  @action
  openSettings = () => {
    this.secondaryWindowType = WINDOW_TYPES.SETTING;
  };

  @action
  closeSecondaryWindow = () => {
    this.secondaryWindowType = null;
  };

  @action
  openAnimation = () => {
    this.secondaryWindowType = WINDOW_TYPES.ANIMATION;
  };

  @action
  setWideWindow = () => {
    this.wideWindow = false;
  };

  @action
  setToolbarItem = (id, options = {}) => {
    this.toolbarItem = { id, options };
  };

  @action
  showProducePanel = (options) => {
    this.setLibraryType(null, true);
    this.setToolbarItem(TOOLBARS.PRODUCE, options);
  };

  @action
  setInitialView = () => {
    this.setLibraryType(null);
    this.setToolbarItem(TOOLBARS.ELEMENTS);
  };
}
