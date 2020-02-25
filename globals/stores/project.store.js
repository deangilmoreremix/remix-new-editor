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
  isLoading = false;

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
  async templates(count = 0, query = '') {
    this.isLoading = true;
    const page = Math.ceil(count / this.perPage);
    try {
      return this.request(
        `/api/makes/templates?editor=go&perPage=${this.perPage}&page=${page + 1}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async nicheScripts(count = 0, query = '') {
    this.isLoading = true;
    const page = Math.ceil(count / this.perPage);
    try {
      return this.request(
        `/api/makes/go?segment=nicheScripts&perPage=${this.perPage}&page=${page + 1}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async cta(count = 0, query = '') {
    this.isLoading = true;
    const page = Math.ceil(count / this.perPage);
    try {
      return this.request(
        `/api/makes/go?segment=cta&perPage=${this.perPage}&page=${page + 1}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async defaults(count = 0, query = '') {
    this.isLoading = true;
    const page = Math.ceil(count / this.perPage);
    try {
      return this.request(
        `/api/makes/go?segment=defaults&perPage=${this.perPage}&page=${page + 1}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async get(projectId, isSource) {
    this.isLoading = true;
    const path = isSource
      ? `/api/users/me/makes/${projectId}`
      : `/api/users/me/makes/${projectId}/remix`;
    try {
      return this.request(
        path, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async save(project) {
    this.isLoading = true;
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
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async publish(project) {
    this.isLoading = true;
    try {
      const response = await this.request(
        `/api/users/me/makes/${project.make._id}/publish`, {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
      project.make.url = response.url;
      project.make.contentUrl = response.contenturl;
      return project;
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async linkToFbPage(project, pageId, queryString) {
    this.isLoading = true;
    try {
      return this.request(
        `/api/makes/${project.make._id}/link-to-fb-page/${pageId}`, {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: { queryString },
        });
    } finally {
      this.isLoading = false;
    }
  }

  @action
  async invalidateFbCache(url) {
    this.isLoading = true;
    try {
      return this.request(
        '/api/makes/update-fb-cache', {
          method: 'POST',
          headers: {
            'on-behalf': this.currentUser.id,
          },
          body: { publishUrl: url },
        });
    } finally {
      this.isLoading = false;
    }
  }
}
