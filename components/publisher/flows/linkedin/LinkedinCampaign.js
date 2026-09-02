import { Component } from '../../../base/Component.js';
import { getStore } from '../../../base/Store.js';
import CampaignStage from '../CampaignStage.js';
import PropTypes from '../../../../lib/PropTypes.js';
import { LINKEDIN_STAGES as STAGES } from '../../../../lib/constants/campaigns/stages.js';
import {
  DEFAULT,
  EMBED_ENGINE,
  EMBED_LOCATION,
  LINKEDIN_LOGIN,
  LINKEDIN_POST,
} from '../../../../lib/constants/campaigns/constants.js';
import { showError, showInfo } from '../../../../lib/services/alertService.js';
import { SOCIAL_CAMPAIGN_MODAL } from '../../../../lib/constants/modals.js';

export class LinkedinCampaign extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.modalStore = getStore('modalStore');

    this.state = {
      currentStageIndex: 0,
      currentStage: STAGES[0],
    };

    this.subscribeToStore(this.projectStore, () => {
      // Update if needed
    });
  }

  async sharePost() {
    this.props.setLoading(true);
    const { postData, embedPage, preload } = this.props.settings;
    try {
      await this.projectStore.updateItem({
        name: postData.title,
        description: postData.description,
        thumbnail: postData.thumbnail,
      });
      await this.projectStore.save();
      await this.props.share({
        title: postData.title,
        description: postData.description,
        url: [
          this.props.settings.embedLocation.key === 'default' ? this.projectStore.item.url : embedPage, [
            !preload ? 'preload=none' : null,
            'preferred_source=linkedin',
          ].filter(item => !!item).join('&'),
        ].join('?'),
        thumbnail: postData.thumbnail,
      });
      this.modalStore.closeModal(SOCIAL_CAMPAIGN_MODAL);
      showInfo('Success');
    } catch (error) {
      showError('This post has already been shared.');
    }
    this.props.setLoading(false);
    return this.projectStore.item;
  }

  canBypassStage(stage) {
    const { embedPage, postData, userData, authorized } = this.props.settings;

    switch (stage.key) {
      case EMBED_ENGINE:
        return true;
      case EMBED_LOCATION:
        return embedPage && embedPage.length > 0;
      case LINKEDIN_LOGIN: {
        return authorized;
      }
      case LINKEDIN_POST:
        return userData && postData && postData.title && postData.title.length > 0;
      default:
        return false;
    }
  }

  nextStage() {
    if (this.state.currentStage.key === STAGES[STAGES.length - 1].key) {
      return this.sharePost();
    }

    let nextStageIdx = Math.min(this.state.currentStageIndex + 1, STAGES.length - 1);
    if (STAGES[nextStageIdx].key === EMBED_LOCATION
      && [DEFAULT].includes(this.props.settings.embedLocation.key)) {
      nextStageIdx += 1;
    }
    this.setState({ currentStageIndex: nextStageIdx });
  }

  prevStage() {
    let prevStageIdx = Math.max(
      this.state.currentStageIndex - 1,
      0,
    );
    if (STAGES[prevStageIdx].key === EMBED_LOCATION && this.props.settings.embedLocation.key === DEFAULT) {
      prevStageIdx = Math.max(prevStageIdx - 1, 0);
    }
    this.setState({ currentStageIndex: prevStageIdx });
  }

  setStage(stageKey) {
    if (this.state.currentStage.key === stageKey) {
      return;
    }

    const nextStageIdx = STAGES.findIndex(item => item.key === stageKey);

    this.setState({ currentStageIndex: nextStageIdx });
  }

  handleBackButtonClick() {
    if (this.props.isLoading || this.state.currentStageIndex === 0) {
      return;
    }
    return this.prevStage();
  }

  handleNextButtonClick() {
    if (!this.canBypassStage(this.state.currentStage)) {
      return;
    }
    if (this.state.currentStage.key === STAGES[STAGES.length - 1].key) {
      return this.sharePost();
    } else {
      return this.nextStage();
    }
  }

  async bootstrap(st) {
    if (st && st.bootstrap) {
      const bootstrapData = {
        init: this.props.init,
        isAuthorized: this.props.isAuthorized,
        nextStage: this.nextStage.bind(this),
        setStage: this.setStage.bind(this),
        fetchPagesData: this.props.fetchPagesData,
        updateCampaign: this.props.updateCampaign,
        getPageTabs: this.props.getPageTabs,
        fetchUserData: this.props.fetchUserData,
        project: this.projectStore.item,
        setLoading: this.props.setLoading,
      };
      return st.bootstrap(bootstrapData);
    } else {
      this.props.setLoading(false);
    }
  }

  onUpdate() {
    this.setState({ currentStage: STAGES[this.state.currentStageIndex] });
    this.bootstrap(STAGES[this.state.currentStageIndex]);
  }

  render() {
    const stageProps = {
      settings: this.props.settings,
      updateCampaign: this.props.updateCampaign,
      project: this.projectStore.item,
      provider: {
        logIn: this.props.logIn,
        fetchPagesData: this.props.fetchPagesData,
        getPageTabs: this.props.getPageTabs,
        createTab: this.props.createTab,
        fetchUserData: this.props.fetchUserData,
      },
      setStage: this.setStage.bind(this),
      nextStage: this.nextStage.bind(this),
      uploadFile: this.props.uploadFile,
      handleBackButtonClick: this.handleBackButtonClick.bind(this),
      handleNextButtonClick: this.handleNextButtonClick.bind(this),
      canBypassStage: this.canBypassStage.bind(this),
      isLoading: this.props.isLoading,
    };

    const campaignStage = new CampaignStage({
      index: this.state.currentStageIndex,
      stage: this.state.currentStage,
      ...stageProps,
    });

    return campaignStage.render();
  }
}

LinkedinCampaign.propTypes = {
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.shape({
      name: PropTypes.string,
    }),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    preload: PropTypes.bool,
    postData: PropTypes.shape({
      title: PropTypes.string,
      thumbnail: PropTypes.string,
    }),
  }).isRequired,
  collapseConductor: PropTypes.func.isRequired,
  expandConductor: PropTypes.func.isRequired,
  init: PropTypes.func.isRequired,
  isAuthorized: PropTypes.func.isRequired,
  logIn: PropTypes.func.isRequired,
  fetchPagesData: PropTypes.func,
  getPageTabs: PropTypes.func,
  createTab: PropTypes.func,
  fetchUserData: PropTypes.func.isRequired,
  share: PropTypes.func.isRequired,
  updateCampaign: PropTypes.func.isRequired,
};

export default LinkedinCampaign;