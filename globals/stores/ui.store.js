import { observable, action } from 'mobx';

export default class UIStore {
  @observable libraryType = null;

  @action
  setLibraryType = (type) => {
    this.libraryType = type;
  }
}
