import { observable, action, reaction, computed } from 'mobx';
import { WINDOW_TYPES, TOOLBARS } from '../../lib/constants/ui';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';

import { radioButton } from '../../lib/constants/windowsLogics';

export default class UIStore {
  constructor(props) {
    this.projectStore = props.projectStore;
    reaction(
      () => this.projectStore.activeElementId,
      () => {
        if (this.projectStore.activeElementId && this.projectStore.element
          && Object.values(POPCORN_ELEMENT_TYPES).includes(this.projectStore.element.type)) {
          this.toggleRightBlock();
          this.secondaryWindowType = WINDOW_TYPES.SETTING;
          if (this.prevStateProduce) {
            this.toggleLeftBlock(false);
            this.setPrevStateProduce(false);
            this.radioButtonBottom = false;
            this.radioButtonTop = true;
          }
          this.isExpand = false;
        } else if (this.projectStore.activeElementId
          && this.projectStore.retarget
          && this.projectStore.retarget.id === this.projectStore.activeElementId) {
          this.secondaryWindowType = WINDOW_TYPES.SETTING;
        } else {
          this.toggleRightBlock(false);
          this.secondaryWindowType = null;
        }
      },
    );
  }

  // window switching logic
  @observable radioButtonTop = false;

  @observable radioButtonBottom = false;

  @observable checkboxLeft = false;

  @observable checkboxRight = false;

  @observable isExpand = true;

  @observable prevStateProduce = false;

  @action
  closeAllWindows = () => {
    this.radioButtonTop = false;
    this.radioButtonBottom = false;
    this.checkboxLeft = false;
    this.checkboxRight = false;
    this.toggleIsExpand(true);
    this.toggleTimeLine();
  };

  @action
  setPrevStateProduce = (value) => {
    this.prevStateProduce = value;
  };
  // window switching logic

  // timeline
  @observable isTimelineOpen = false;

  @action
  toggleTimeLine = (value = false) => {
    this.isTimelineOpen = value;
  };
  // timeline

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
    this.toggleRightBlock();
    this.secondaryWindowType = type;
  };

  @action
  openStickers = (type) => {
    this.secondaryWindowType = type;
  };

  @action
  openLowerThird = (tab = WINDOW_TYPES.LOWER_THIRDS) => {
    this.secondaryWindowType = tab;
  }

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
  toggleLeftBlock = (isOpen = true) => {
    if (!this.checkboxRight && !isOpen) {
      this.toggleIsExpand();
    }
    this.checkboxLeft = isOpen;
  };

  @action
  toggleRightBlock = (isOpen = true) => {
    if (!this.checkboxLeft && !isOpen) {
      this.toggleIsExpand();
    }
    this.closeSecondaryWindow();
    this.checkboxRight = isOpen;
  };

  @action
  toggleIsExpand = (value = true) => {
    this.isExpand = value;
  };

  @action
  changeRadioButton = (value) => {
    this.toggleIsExpand(false);

    if (value === radioButton.TOP) {
      this.radioButtonTop = true;
      this.radioButtonBottom = false;
      this.checkboxLeft = true;
      this.setPrevStateProduce(false);
    } else {
      this.checkboxLeft = true;
      this.checkboxRight = false;
      this.radioButtonBottom = true;
      this.radioButtonTop = false;
      this.secondaryWindowType = null;
      this.prevStateProduce = true;
    }
  };

  @computed
  get canvasWidth() {
    if (this.checkboxRight && !this.checkboxLeft) {
      return 7;
    }
    if (this.isExpand) {
      return 11;
    } else if (!this.checkboxRight && this.checkboxLeft && !this.radioButtonBottom) {
      return 9;
    } else if ((this.checkboxRight && this.checkboxLeft) || this.radioButtonBottom) {
      return 5;
    } else {
      return 5;
    }
  }

  @computed
  get toolsWidth() {
    if (this.checkboxRight && !this.checkboxLeft) {
      return 5;
    }

    if (this.isExpand) {
      return 1;
    } else if (!this.checkboxRight && this.checkboxLeft && !this.radioButtonBottom) {
      return 3;
    } else if ((this.checkboxRight && this.checkboxLeft) || this.radioButtonBottom) {
      return 7;
    } else {
      return 7;
    }
  }

  @action
  openMediaButton = (type) => {
    this.isExpand = false;
    this.radioButtonTop = true;
    this.radioButtonBottom = false;
    this.setLibraryType(type);
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
  setSecondaryWindowType = (type) => {
    this.secondaryWindowType = type;
  }

  @action
  setInitialView = () => {
    this.projectStore.releaseElement();
    this.setToolbarItem(TOOLBARS.ELEMENTS);
  };
}
