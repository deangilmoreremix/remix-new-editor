import BaseStore from './base.store';
import { makeTypes } from '../../lib/constants/makes';
import { TEMPLATES_SEGMENTS } from '../../lib/constants/templateSegments';

export default class PresetStore extends BaseStore {
  getNicheScripts = ({ page = 1, query = '', perPage = 20 }) => {
    try {
      return this.request(
        `/api/makes/revolution?segment=${TEMPLATES_SEGMENTS.NICHE_SCRIPTS}&perPage=${perPage}&page=${page}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  downloadOptinStatistic = async (projectId) => {
    const perPage = 100000;
    let csvContent = 'data:text/csv;charset=utf-8,';
    const link = window.document.createElement('a');
    const orderBy = JSON.stringify({ createdAt: -1 });
    const filter = JSON.stringify({ action: 'video_opted_in' });
    const path = `/api/projects/${projectId}/events`;
    const data = [];
    try {
      const result = await this.getList(
        {
          perPage,
          path,
          orderBy,
          filter,
        });
      if (result.length > 0) {
        const keys = [];
        result.forEach((item) => {
          Object.keys((item.extra && item.extra.data) || item.extra || {}).forEach((key) => {
            if (keys.indexOf(key) === -1) {
              keys.push(key);
            }
          });
        });
        data.push(['Date', 'Time', 'Source', ...keys]);
        result.forEach((optin) => {
          data.push([new Date(optin.createdAt).toLocaleString(), optin.extra && optin.extra.source,
            ...keys.map((key) => (optin.extra.data && optin.extra.data[key])
            || (optin.extra && optin.extra[key]))]);
        });
      }
    } catch (e) {
      console.error(e);
    }
    data.forEach((rowArray) => {
      const row = rowArray.join(',');
      csvContent += `${row}\n`;
    });
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'upload_data.csv');
    link.click();
  };

  getTemplatesCTA = ({ page = 1, query = '', perPage = 20 }) => (
    this.getList({ page, query, perPage, params: { segment: TEMPLATES_SEGMENTS.CTA }, path: '/api/makes/revolution' })
  );

  getTemplatesBlendMode = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: TEMPLATES_SEGMENTS.BLEND_MODE }, path: '/api/makes/revolution' })
  );

  getPresets = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.PRESETS }, path: '/api/makes/revolution' })
  );

  getJsonTransitions = ({ page = 1, query = '', perPage = 12, filter = {} }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.TRANSITIONS }, path: '/api/makes/revolution', filter: JSON.stringify(filter) })
  );

  getConnect = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.CONNECT }, path: '/api/makes/revolution' })
  );

  // Evolution template section
  getImageLTPreset = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.EVN_IMAGE_LT_PRESETS }, path: '/api/makes/revolution' })
  );

  getEvolutionTemplatesCTA = ({ page = 1, query = '', perPage = 20 }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.EVN_CTA }, path: '/api/makes/revolution' })
  );

  getEvolutionTemplatesBlendMode = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.EVN_BLEND_MODE }, path: '/api/makes/revolution' })
  );

  evolutionPresets = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: makeTypes.EVN_PRESETS }, path: '/api/makes/revolution' })
  );
}
