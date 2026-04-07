import { Component } from '../../../base/Component.js';
import { getStore } from '../../../base/Store.js';
import PropTypes from '../../../../lib/PropTypes.js';
import CampaignStage from '../CampaignStage.js';
import { EMAIL_STAGES } from '../../../../lib/constants/campaigns/stages.js';
import PROVIDERS from '../../../../lib/constants/campaigns/email-providers.js';
import {
  EMAIL_EMBED_LOCATIONS,
  EMBED_LOCATION,
  EMAIL_SKIP_TOKENS,
  DEFAULT,
  SERVICE_PROVIDER,
  EMAIL_FRAME,
} from '../../../../lib/constants/campaigns/constants.js';

export class EmailCampaign extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');

    this.state = {
      currentStage: { ...EMAIL_STAGES[0] },
      settings: {
        embedLocation: EMAIL_EMBED_LOCATIONS[0],
        embedPage: null,
        emailProvider: PROVIDERS[0],
        preload: true,
        error: null,
      },
    };

    this.subscribeToStore(this.projectStore, () => {
      // Update if needed
    });
  }

  updateCampaign(newSettings) {
    this.setState({
      settings: { ...this.state.settings, ...newSettings },
    });
  }

  onUpdate() {
    // Simulate useEffect
    if (this.state.settings.embedLocation.key === EMAIL_FRAME) {
      this.setState({
        currentStage: { ...this.state.currentStage, completionPercentage: 100 },
      });
    } else {
      this.setState({
        currentStage: { ...EMAIL_STAGES[0] },
      });
    }
  }

  canBypassStage(stage) {
    const { embedPage, emailProvider } = this.state.settings;
    if (this.props.isLoading) {
      return false;
    }
    switch (stage.key) {
      case EMAIL_STAGES[0].key:
        return true;
      case EMAIL_STAGES[1].key:
        return embedPage && embedPage.length > 0;
      case EMAIL_STAGES[2].key:
        return emailProvider;
      default:
        return false;
    }
  }

  handleNextButtonClick() {
    if (!this.canBypassStage(this.state.currentStage)) {
      return;
    }
    const { embedLocation } = this.state.settings;
    let nextStageIdx = Math.min(
      EMAIL_STAGES.findIndex(item => this.state.currentStage.key === item.key) + 1,
      EMAIL_STAGES.length - 1,
    );
    if (EMAIL_STAGES[nextStageIdx].key === EMBED_LOCATION && embedLocation.key === DEFAULT) {
      nextStageIdx += 1;
    }
    this.setState({ currentStage: EMAIL_STAGES[nextStageIdx] });
  }

  handleBackButtonClick() {
    const { embedLocation } = this.state.settings;
    let prevStageIdx = Math.max(
      EMAIL_STAGES.findIndex(item => this.state.currentStage.key === item.key) - 1,
      0,
    );
    if (EMAIL_STAGES[prevStageIdx].key === EMBED_LOCATION && embedLocation.key === DEFAULT) {
      prevStageIdx = Math.max(prevStageIdx - 1, 0);
    }
    this.setState({ currentStage: EMAIL_STAGES[prevStageIdx] });
  }

  handleSelectPage({ value }, name) {
    switch (name) {
      case EMBED_LOCATION:
        this.updateCampaign({ embedLocation: EMAIL_EMBED_LOCATIONS.find(item => item.key === value) });
        break;
      case SERVICE_PROVIDER:
        this.updateCampaign({ emailProvider: PROVIDERS.find(item => item.key === value) });
        break;
      default:
    }
  }

  handleSelectProvider(emailProvider) {
    return () => {
      this.updateCampaign({ emailProvider });
    };
  }

  generatePersonalizedLink() {
    const { preload, embedLocation, emailProvider, embedPage } = this.state.settings;
    const { token, lookup, format } = emailProvider;
    const basicPath = embedLocation.key === DEFAULT ? this.projectStore.item.url : embedPage;
    let personalizations = this.projectStore.getPersonalization();
    personalizations = personalizations
      .filter(personalization => !EMAIL_SKIP_TOKENS.includes(personalization));
    const queryParams = personalizations.map(param => {
      const { open, close } = token;
      let formattedParam;

      if (lookup && param in lookup) {
        formattedParam = lookup[param];
      } else if (format) {
        formattedParam = format(param);
      } else {
        formattedParam = param;
      }
      return `${param}=${open}${formattedParam}${close}`;
    });

    if (!preload) {
      queryParams.unshift('preload=none');
    }

    return `${basicPath}${queryParams.length ? `?${queryParams.join('&')}` : ''}`;
  }

  render() {
    const stageProps = {
      settings: this.state.settings,
      project: this.projectStore.item,
      updateCampaign: this.updateCampaign.bind(this),
      canBypassStage: this.canBypassStage.bind(this),
      generatePersonalizedLink: this.generatePersonalizedLink.bind(this),
      handleSelectPage: this.handleSelectPage.bind(this),
      handleSelectProvider: this.handleSelectProvider.bind(this),
    };

    const campaignStage = new CampaignStage({
      index: EMAIL_STAGES.findIndex(stage => stage.key === this.state.currentStage.key),
      stage: this.state.currentStage,
      ...stageProps,
      handleBackButtonClick: this.handleBackButtonClick.bind(this),
      handleNextButtonClick: this.handleNextButtonClick.bind(this),
      handleClose: this.props.handleClose,
      isLoading: this.props.isLoading,
    });

    return campaignStage.render();
  }
}

EmailCampaign.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default EmailCampaign;