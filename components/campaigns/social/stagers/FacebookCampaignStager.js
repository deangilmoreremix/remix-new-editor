/**
 * Created by Eugene Butusov on 05/11/2018.
 */

import SocialStager from './SocialStager';


class FacebookCampaignStager extends SocialStager {
  // constructor(options) {
  //   super(options);
  //   this.stages.login.bootstrap = async (isForward) => {
  //     try {
  //       if (await options.provider.isAuthorized()) {
  //         if (isForward) {
  //           return this.nextStage();
  //         } else {
  //           return this.prevStage();
  //         }
  //       }
  //       return this.setStage('login');
  //     } catch (error) {
  //       alert(error.message);
  //       return this.setStage('login');
  //     }
  //   };
  // }

  canByPassStage = (options = {}) => {
    const { step, provider: { userIsAuthorized } } = options;
    if (step === 'login' && !userIsAuthorized) {
      return false;
    }
    return true;
  }
}

export default FacebookCampaignStager;
