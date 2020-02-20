/**
 * Created by Eugene Butusov on 20/05/2019.
 */

import Cookie from 'universal-cookie';
import AbstractProvider from './AbstractProvider';

const VIDEO_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const YT_COOKIE_NAME = 'yt_acc_tkn';
const PROVIDER_NAME = 'youtube';

class YoutubeUploadProvider extends AbstractProvider {
  constructor(config) {
    super(config);
    this.request = config.request;
    this.cookies = new Cookie();
  }

  isAuthorized() {
    return !!this.cookies.get(YT_COOKIE_NAME);
  }

  logIn() {
    return new Promise((resolve) => {
      const youtubeLoginWindow = window.open(
        `//${this.config.backend}/api/rendering/jobs/social-proxy/youtube/auth?scope=${VIDEO_UPLOAD_SCOPE}`,
        'youtube_login',
        'width=650,height=650');
      const loginCheckInterval = setInterval(() => {
        if (youtubeLoginWindow.closed) {
          clearInterval(loginCheckInterval);
          resolve();
        }
      }, 100);
    });
  }

  async publish(project, { title, description }) {
    await this.request(`/api/rendering/jobs/${project._id}/publish/${PROVIDER_NAME}`, {
      method: 'POST',
      body: {
        title,
        description,
        auth: this.cookies.get(YT_COOKIE_NAME),
      },
    });
    let updatedProject = project;
    while (!(
      updatedProject.shares.find(item => item.provider === PROVIDER_NAME)
      && updatedProject.shares.find(item => item.provider === PROVIDER_NAME).url)) {
      // eslint-disable-next-line no-await-in-loop,no-loop-func
      updatedProject = await new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(this.request(`/api/users/me/rendering/jobs/${project._id}`, {
              method: 'GET',
            }));
          } catch (error) {
            reject(error);
          }
        }, 5000);
      });
    }
    return updatedProject;
  }
}

export default YoutubeUploadProvider;
