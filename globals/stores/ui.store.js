import { observable, action } from 'mobx';

export default class UIStore {
  @observable libraryType = null;

  @observable animationType = null;

  @action
  setLibraryType = (type) => {
    this.animationType = null;
    this.libraryType = type;
  };

  @action
  setAnimationType = (type) => {
    this.libraryType = null;
    this.animationType = type;
  }
}
