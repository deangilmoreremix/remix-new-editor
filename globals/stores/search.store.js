import { observable, action } from 'mobx';

export default class SearchStore {
  @observable q = '';

  @observable isVideo = false;

  @observable isImage = false;


  @action
  setIsVideo = (value) => {
    this.isVideo = value;
  }

  @action
  setIsImage = (value) => {
    this.isImage = value;
  }

  @action
  setQ = (value) => {
    this.q = value || '';
  }

  @action
  reset = () => {
    this.q = '';
    this.isImage = false;
    this.isVideo = false;
  }
}
