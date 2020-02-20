/**
 * Created by Ekaterina Maksimlyuk on 17/05/2019.
 */

import Login from '../steps/Login';
import ShareHOC from '../steps/Share';
import Stager from '../../Stager';

class SocialStager extends Stager {
  static steps = ['login', 'sharing'];

  constructor(options) {
    super(options);
    const { project, provider } = options;
    this.stages = {
      login: {
        element: Login,
        className: 'social-login',
        bootstrap: async (stages, skipCallback) => {
          skipCallback = skipCallback || this.nextStage;
          if (await provider.isAuthorized()) {
            return skipCallback();
          }
        },
      },
      sharing: {
        element: ShareHOC(),
        className: 'social-sharing',
      },
    };
    this.data = {
      title: project.title,
      description: project.description,
    };
    this.lastButtonName = 'Share';
  }

  canBypassStage() {
    switch (this.step) {
      case 'login':
        return false;
      default:
        return true;
    }
  }

  async publish() {
    const { provider } = this;
    await provider.publish({
      backend: this.common.backend,
      projectLink: this.project.artifact,
      thumbnail: this.project.cover,
      stagerData: this.data,
    });
    this.onCampaignFinished();
  }
}

export default SocialStager;
