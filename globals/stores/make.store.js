import BaseStore from './base.store';
import { TEMPLATES_SEGMENTS } from '../../lib/constants/templateSegments';

export default class PresetStore extends BaseStore {
  getNicheScripts = ({ page = 1, query = '', perPage = 20 }) => {
    try {
      return this.request(
        `/api/makes/go?segment=${TEMPLATES_SEGMENTS.NICHE_SCRIPTS}&perPage=${perPage}&page=${page}&q=${query}`, {
          method: 'GET',
          headers: {
            'on-behalf': this.currentUser.id,
          },
        });
    } finally {
      this.isLoading = false;
    }
  }

  getTemplatesCTA = ({ page = 1, query = '', perPage = 20 }) => (
    this.getList({ page, query, perPage, params: { segment: TEMPLATES_SEGMENTS.CTA }, path: '/api/makes/revolution' })
  );

  getTemplatesBlendMode = ({ page = 1, query = '', perPage = 12 }) => (
    this.getList({ page, query, perPage, params: { segment: TEMPLATES_SEGMENTS.BLEND_MODE }, path: '/api/makes/revolution' })
  );
}
