import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import PropTypes from '../../../lib/PropTypes.js';
import FacebookProvider from './facebook/FacebookProvider.js';
import LinkedinProvider from './linkedin/LinkedinProvider.js';
import withModal from '../../hoc/withModal.js';
import {
  FACEBOOK_SOURCE_ID,
  LINKEDIN_SOURCE_ID,
  SOCIAL_SOURCES,
  POSTER_FRAME_RECOMMENDED_RESOLUTION,
  EMBED_LOCATIONS,
} from '../../../lib/constants/campaigns/constants.js';
import { NOT_SUPPORTED_IMAGE_FORMAT } from '../../../lib/constants/media.js';
import { isResolutionWrong, modalContent } from '../../../lib/utils/cropHelper.js';
import MediaTypeDetector from '../../../lib/utils/mediaTypeDetector.js';

class CampaignSelector extends Component {
  constructor(props = {}) {
    super(props);
    this.mediaStore = getStore('mediaStore');
    this.commonStore = getStore('commonStore');
    this.projectStore = getStore('projectStore');

    this.state = {
      flowId: null,
      settings: {
        embedLocation: EMBED_LOCATIONS[0],
        postData: {
          title: this.projectStore.item.title,
          description: this.projectStore.item.description,
          thumbnail: this.projectStore.item.thumbnail,
          url: this.projectStore.item.url,
        },
        userData: null,
        selectedFbPage: null,
        embedPage: null,
        facebookPages: null,
        facebookPageTab: null,
        preload: true,
        error: null,
        authorized: false,
      },
    };

    this.subscribeToStore(this.projectStore, () => {
      this.setState({
        settings: {
          ...this.state.settings,
          postData: {
            title: this.projectStore.item.title,
            description: this.projectStore.item.description,
            thumbnail: this.projectStore.item.thumbnail,
            url: this.projectStore.item.url,
          },
        },
      });
    });
  }

  updateCampaign(newSettings) {
    this.setState({
      settings: { ...this.state.settings, ...newSettings },
    });
  }

  showError(error, timeout = null) {
    this.updateCampaign({ error: error.message || NOT_SUPPORTED_IMAGE_FORMAT });
    if (timeout) {
      this.setTimer(() => {
        this.updateCampaign({ error: null });
      }, timeout);
    }
  }

  uploadFile(callback) {
    return async (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      if (!file.type.includes('image/')) {
        this.showError(new Error(NOT_SUPPORTED_IMAGE_FORMAT), 5000);
        this.props.openModal({
          header: 'Error',
          body: NOT_SUPPORTED_IMAGE_FORMAT,
        });
        return;
      }
      try {
        const media = await this.mediaStore.uploadMedia({ data: file });
        const imageMeta = await new MediaTypeDetector().getMetadata(media.url);
        if (isResolutionWrong({
          imageMeta,
          recommendedResolution: POSTER_FRAME_RECOMMENDED_RESOLUTION,
        })) {
          this.props.openModal(modalContent({
            imageMeta,
            recommendedResolution: POSTER_FRAME_RECOMMENDED_RESOLUTION,
            onFileUploaded: (res) => {
              callback(res);
              this.props.closeModal();
            },
          }));
        } else {
          callback(imageMeta);
        }
      } catch (err) {
        console.log(err);
        this.props.openModal({
          header: 'Error',
        });
        this.showError(err, 5000);
      }
    };
  }

  renderFlowSelector() {
    const container = document.createElement('div');
    container.className = 'social-source-list';

    const project = this.projectStore.item.project;
    if (project && project.allowedSocials) {
      project.allowedSocials.forEach(socialId => {
        const source = SOCIAL_SOURCES.find(s => s.key === socialId);
        if (!source) {
          return;
        }

        const button = document.createElement('button');
        button.className = 'social-source-list-item';
        button.type = 'button';
        this.addEventListener(button, 'click', () => {
          this.setState({ flowId: socialId });
        });

        const svgContainer = document.createElement('div');
        svgContainer.className = 'campaign-icon';
        svgContainer.innerHTML = source.image; // Assuming SVG is string
        button.appendChild(svgContainer);

        container.appendChild(button);
      });
    }

    return container;
  }

  renderFlow(key) {
    const commonProps = {
      ...this.props,
      settings: this.state.settings,
      updateCampaign: this.updateCampaign.bind(this),
      uploadFile: this.uploadFile.bind(this),
      closeModal: this.props.closeModal,
    };

    switch (key) {
      case FACEBOOK_SOURCE_ID: {
        const provider = new FacebookProvider({
          ...commonProps,
          appId: this.commonStore.facebookAppId,
        });
        return provider.render();
      }
      case LINKEDIN_SOURCE_ID: {
        const provider = new LinkedinProvider({
          ...commonProps,
          appId: this.commonStore.linkedinAppId,
        });
        return provider.render();
      }
      default:
        return null;
    }
  }

  render() {
    const fragment = document.createDocumentFragment();

    if (this.state.flowId) {
      const flowElement = this.renderFlow(this.state.flowId);
      if (flowElement) {
        fragment.appendChild(flowElement);
      }
    } else {
      fragment.appendChild(this.renderFlowSelector());
    }

    if (this.state.settings.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'campaign-error';
      errorDiv.textContent = this.state.settings.error;
      fragment.appendChild(errorDiv);
    }

    return fragment;
  }
}

CampaignSelector.propTypes = {
  openModal: PropTypes.func.isRequired,
  closeModal: PropTypes.func.isRequired,
};

export default withModal(CampaignSelector);