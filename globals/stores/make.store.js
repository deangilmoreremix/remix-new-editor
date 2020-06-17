import BaseStore from './base.store';

export default class PresetStore extends BaseStore {
  getNicheScripts = ({ page = 1, query = '', perPage = 20 }) => {
    try {
      return this.request(
        `/api/makes/go?segment=nicheScripts&perPage=${perPage}&page=${page}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  getTemplatesCTA = ({ page = 1, query = '', perPage = 20 }) => {
    try {
      return this.request(
        `/api/makes/revolution?segment=cta&perPage=${perPage}&page=${page}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  getPresets = ({ page = 1, query = '', perPage = 20 }) => {
    try {
      return this.request(
        `/api/makes/revolution?segment=presets&perPage=${perPage}&page=${page}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }
}
