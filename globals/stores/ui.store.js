import { observable, action } from 'mobx';

export default class UIStore {
  @observable libraryType = null;

  @observable showAnimation = false;

  @action
  setLibraryType = (type) => {
    this.animationType = null;
    this.libraryType = type;
  };

  @action
  openAnimation = () => {
    this.libraryType = null;
    this.showAnimation = true;
  }
}
