import { observable, action } from 'mobx';

export default class UI {
  @observable libraryType = null;

  @action
  setLibraryType = (type) => {
    this.libraryType = type;
  }
}
