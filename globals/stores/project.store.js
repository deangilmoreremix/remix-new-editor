import { observable, action } from 'mobx';

import BaseStore from './base.store';

const defaultItem = {
  tags: [],
  title: '',
  background: '',
  description: '',
  allowedSocials: [],
};

export default class ProjectStore extends BaseStore {
  constructor(props) {
    super(props);
    this.item = defaultItem;
  }

  @observable
  item = {};

  @action
  getOne = async (projectId) => {
    if (!projectId) {
      this.item = defaultItem;
      return this.item;
    }
    const path = `/api/users/me/makes/${projectId}`;
    try {
      this.item = await this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } catch (e) {
      this.item = defaultItem;
      throw e;
    }
    return this.item;
  };

  @action
  updateItem = (value) => {
    this.item = { ...this.item, ...value };
  };

  @action
  addAsset = (asset) => {
    this.assets.push(asset);
  };
}
