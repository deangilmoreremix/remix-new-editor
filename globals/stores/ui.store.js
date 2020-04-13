import { observable, action } from 'mobx';

export default class UIStore {
  @observable libraryType = null;

  @observable wideWindow = false;

  @action
  setLibraryType = (type) => {
    this.libraryType = type;
  };

  @action
  setWideWindow = (value = true) => {
    this.wideWindow = value;
  }
}
