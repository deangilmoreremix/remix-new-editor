/**
 * Created by Eugene Butusov on 20/05/2019.
 */

import ShareHOC from '../steps/Share';
import SocialStager from './SocialStager';

const PROVIDER_NAME = 'youtube';

class YoutubeCampaignStager extends SocialStager {
  constructor(options) {
    super(options);

    this.stages.sharing.element = ShareHOC(PROVIDER_NAME);
    if (
      this.project.shares
        && this.project.shares.find(item => item.provider === PROVIDER_NAME)
        && this.project.shares.find(item => item.provider === PROVIDER_NAME).url
    ) {
      delete this.lastButtonName;
    } else {
      this.lastButtonName = 'Share';
    }
  }

  canBypassStage() {
    switch (this.step) {
      case 'sharing':
        return !(
          this.project.shares &&
          this.project.shares.find(item => item.provider === PROVIDER_NAME) &&
          this.project.shares.find(item => item.provider === PROVIDER_NAME).url
        );
      default:
        return super.canBypassStage();
    }
  }

  async publish() {
    const { project, provider, data } = this;
    this.project = await provider.publish(project, data);
  }
}

export default YoutubeCampaignStager;
