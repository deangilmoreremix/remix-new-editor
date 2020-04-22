import { observable, action, reaction } from 'mobx';
import { WINDOW_TYPES } from '../../lib/constants/ui';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';

export default class UIStore {
  @observable projectStore = {};

  @observable secondaryWindowType = null;

  @observable wideWindow = false;

  @observable firstWindowType = null;

  @observable hasGuidLines = false;

  @action
  setGuideLines = (value = false) => {
    this.hasGuidLines = value;
  };

  @action
  setLibraryType = (type, isWideWindow = false) => {
    this.wideWindow = isWideWindow;
    this.secondaryWindowType = type;
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

  constructor(props) {
    this.projectStore = props.projectStore;
    reaction(
      () => this.projectStore.activeElementId,
      () => {
        if (this.projectStore.activeElementId
          && Object.values(POPCORN_ELEMENT_TYPES).includes(this.projectStore.element.type)) {
          this.secondaryWindowType = WINDOW_TYPES.SETTING;
        } else {
          this.secondaryWindowType = null;
        }
      },
    );
  }
}
