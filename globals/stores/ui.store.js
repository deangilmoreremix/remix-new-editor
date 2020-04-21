import { observable, action } from 'mobx';

export default class UIStore {
  @observable libraryType = null;

  @observable wideWindow = false;

  @observable showAnimation = false;

  @observable hasGuidLines = false;

  @action
  setGuideLines = (value = false) => {
    this.hasGuidLines = value;
  };

  @action
  setLibraryType = (type) => {
    this.wideWindow = false;
    this.showAnimation = false;
    this.libraryType = type;
  };

  @action
  setWideWindow = () => {
    this.wideWindow = false;
  };

  @action
  openAnimation = () => {
    this.libraryType = null;
    this.showAnimation = true;
  }
}
