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
  @observable item = {};

  @observable
  activeProject = null;

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
            // todo update it. Implemented for testing until login
            'on-behalf': '5a9007349ab52100041dac25',
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
  async save(project) {
    // this.isLoading = true;
    try {
      const path = project.make
        ? `/api/users/me/makes/${project.make._id}`
        : '/api/users/me/makes';
      const serializedProject = project.serialize();
      project.make = await this.request(
        path, {
          method: project.make ? 'PATCH' : 'POST',
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
      console.log(Error(e));
    }
  }
}
