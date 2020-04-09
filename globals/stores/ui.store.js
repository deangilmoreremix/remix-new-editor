import { observable, action } from 'mobx';

export default class UI {
  @observable libraryType = null;

  @observable produceWindow = false;

  @action
  setLibraryType = (type) => {
    this.libraryType = type;
  };

  @action
  setProduceWindow = (value = true) => {
    this.produceWindow = value;
  }
}
