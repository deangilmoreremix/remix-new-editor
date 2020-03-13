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
  };

  @action
  save = async (project) => {
    try {
      const path = project.project
        ? `/api/users/me/makes/${project.project._id}`
        : '/api/users/me/makes';
      const serializedProject = project.serialize();
      project.project = await this.request(
        path, {
          method: project.project ? 'PATCH' : 'POST',
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
      project.modified = false;
      return project;
    } catch (e) {
      console.error(e);
    }
  };
}
