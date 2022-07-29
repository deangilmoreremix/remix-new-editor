import { observable, action, reaction, computed } from 'mobx';
import { WINDOW_TYPES, TOOLBARS, ACTION_LOGOUT } from '../../lib/constants/ui';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';

import { radioButton } from '../../lib/constants/windowsLogics';

import goEditorIcon from '../../public/static/svgImages/templates/go-editor-icon.svg';
import advancedEditorIcon from '../../public/static/svgImages/templates/advanced-editor-icon.svg';
import smartRevolutionEditorIcon from '../../public/static/svgImages/templates/smart-revolution-editor-icon.svg';

export default class UIStore {
  constructor(props) {
    this.projectStore = props.projectStore;
    this.prefixes = props.prefixes;
    this.whiteLabelManager = props.whiteLabelManager;

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
        } else if (!this.isOpenFullWindow) {
          this.toggleRightBlock(false);
          this.secondaryWindowType = null;
        }

        if (!this.isOpenFullWindow) {
          this.isCanvasPresent = true;
        } else {
          this.isOpenFullWindow = false;
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

  @observable isEnabled = false;

  @observable prevStateProduce = false;

  @observable isCanvasPresent = true;

  @observable isOpenFullWindow = false;

  @computed
  get templatesMenuItems() {
    return [
      {
        title: 'Settings',
        url: `${this.projectStore.common.hostname}/account`,
      },
      {
        title: 'Sign Out',
        action: ACTION_LOGOUT,
      },
      {
        title: 'Help',
        url: `${this.projectStore.common.whiteLabel.helpUrl}`,
      },
    ];
  }

  @computed
  get templatesProjectItems() {
    return [
      {
        url: `http://${this.prefixes.go}.${this.whiteLabelManager.domain}`,
        icon: goEditorIcon,
        title: 'Go Editor',
      },
      {
        url: `http://${this.prefixes.editor}.${this.whiteLabelManager.domain}`,
        icon: advancedEditorIcon,
        title: 'Advanced Editor',
      },
      {
        url: `http://${this.prefixes.app}.${this.whiteLabelManager.domain}`,
        icon: smartRevolutionEditorIcon,
        title: 'Smart Video Editor',
      },
    ];
  }

  @action
  closeAllWindows = () => {
    this.radioButtonTop = false;
    this.radioButtonBottom = false;
    this.checkboxLeft = false;
    this.checkboxRight = false;
    this.toggleIsExpand(true);
    this.toggleVisibleCanvas(true);
    this.toggleTimeLine();
  };

  @action
  closeProduceWindow = () => {
    this.radioButtonTop = false;
    this.radioButtonBottom = false;
    this.checkboxLeft = false;
    this.checkboxRight = false;
    if (!this.isTimelineOpen) {
      this.toggleIsExpand(true);
    }
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
    if (this.isExpand && value) {
      this.toggleIsExpand(false);
    }

    if (!value && !this.checkboxLeft && !this.checkboxRight && !this.isExpand) {
      this.toggleIsExpand(true);
    }
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
    this.toggleVisibleCanvas(true);
    this.updateElementInLibrary = value;
  };

  @action
  setListBuilder = () => {
    this.toggleLeftBlock(false);
    this.toggleRightBlock();
    this.secondaryWindowType = WINDOW_TYPES.SETTING;
  };

  @action
  setRecorder = (type) => {
    this.toggleRightBlock();
    this.secondaryWindowType = type;
    this.toggleVisibleCanvas(true);
  };

  @action
  setLibraryType = (type) => {
    this.toggleRightBlock();
    this.toggleLeftBlock(false);
    this.toggleTimeLine(false);
    this.toggleVisibleCanvas(false);
    this.secondaryWindowType = type;
  };

  @action
  setOverlayType = (type) => {
    this.toggleRightBlock();
    this.toggleLeftBlock(false);
    this.toggleTimeLine(false);
    this.secondaryWindowType = type;
  };

  @action
  openTextToSpeech = (type) => {
    this.isOpenFullWindow = true;
    this.projectStore.releaseElement();
    this.secondaryWindowType = type;
    this.toggleLeftBlock(false);
    this.toggleTimeLine(false);
    this.toggleVisibleCanvas(false);
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
  toggleLeftBlock = (isOpen = true) => {
    if (!this.checkboxRight && !isOpen && !this.isTimelineOpen) {
      this.toggleIsExpand();
    }
    this.checkboxLeft = isOpen;
  };

  @action
  toggleRightBlock = (isOpen = true) => {
    if (!this.checkboxLeft && !isOpen && !this.isTimelineOpen) {
      this.toggleIsExpand();
    }
    this.closeSecondaryWindow();
    this.checkboxRight = isOpen;
  };

  @action
  closeAnimationLibrary = () => {
    if (this.projectStore.activeElementId) {
      this.openSettings();
    } else {
      this.toggleRightBlock(false);
    }
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
      this.projectStore.releaseElement();
      this.checkboxLeft = true;
      this.checkboxRight = false;
      this.radioButtonBottom = true;
      this.radioButtonTop = false;
      this.secondaryWindowType = null;
      this.prevStateProduce = true;
    }
  };

  @action
  toggleVisibleCanvas = (value = true) => {
    this.isCanvasPresent = value;
  };

  @action
  openMediaButton = (type) => {
    this.isExpand = false;
    this.radioButtonTop = true;
    this.radioButtonBottom = false;
    this.setLibraryType(type);
    if (!this.isCanvasPresent) {
      this.toggleVisibleCanvas(false);
    }
  };
  @action
  addTogetherJS = (value = false) => {
   this.isEnabled = value
  };

  @action
  setToolbarItem = (id, options = {}) => {
    this.toolbarItem = { id, options };
  };

  @action
  showProducePanel = (options) => {
    this.toggleRightBlock(false);
    this.toggleVisibleCanvas(true);
    this.secondaryWindowType = null;
    this.setToolbarItem(TOOLBARS.PRODUCE, options);
  };

  @action
  setSecondaryWindowType = (type) => {
    this.toggleLeftBlock(false);
    this.toggleRightBlock();
    this.secondaryWindowType = type;
    if (!this.isCanvasPresent) {
      this.toggleVisibleCanvas();
    }
  }

  @action
  setInitialView = () => {
    this.projectStore.releaseElement();
    this.setToolbarItem(TOOLBARS.ELEMENTS);
  };
}
