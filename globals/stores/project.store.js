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
  assets = [];

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

  @action
  serialize() {
    return {
      data: JSON.stringify(this.item),
      allowedSocials: this.item.allowedSocials,
      name: this.item.name,
      editor: 'smart-video',
      description: this.item.description,
      thumbnail: this.item.thumbnail,
      source: this.item.source,
    };
  }

  @action
  save = async () => {
    try {
      const path = this.item
        ? `/api/users/me/makes/${this.item._id}`
        : '/api/users/me/makes';
      const serializedProject = this.serialize();
      this.item = await this.request(
        path, {
          method: this.item ? 'PATCH' : 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: {
            title: serializedProject.name,
            description: serializedProject.description,
            project: serializedProject,
            thumbnail: serializedProject.thumbnail,
            remixedFrom: serializedProject.source,
          },
        });
      this.item.modified = false;
      return this.item;
    } catch (e) {
      console.error(e);
    }
  };
}
