import { observable, action } from 'mobx';

export default class UIStore {
  @observable libraryType = null;

  @observable wideWindow = false;

  @action
  setLibraryType = (type, isWideWindow = false) => {
    this.wideWindow = isWideWindow;
    this.libraryType = type;
  };

  @action
  setWideWindow = (value = true) => {
    this.wideWindow = value;
  }
}
