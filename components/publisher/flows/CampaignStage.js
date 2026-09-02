import { Component } from '../../base/Component.js';
import PropTypes from '../../../lib/PropTypes.js';
import { FACEBOOK_STAGES as STAGES } from '../../../lib/constants/campaigns/stages.js';
import { SERVICE_PROVIDER } from '../../../lib/constants/campaigns/constants.js';

export class CampaignStage extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      link: null,
    };
  }

  closeAndSave() {
    if (this.linkElement) {
      this.linkElement.select();
      document.execCommand('copy');
    }
    this.props.handleClose();
  }

  render() {
    const container = document.createElement('div');

    if (this.props.isLoading) {
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      spinner.textContent = 'Loading...';
      container.appendChild(spinner);
    } else {
      const Stage = this.props.stage.element;
      const stageInstance = new Stage({
        ...this.props,
        setLink: (link) => { this.linkElement = link; },
      });
      const stageElement = stageInstance.render();
      if (stageElement) {
        container.appendChild(stageElement);
      }
    }

    const progress = document.createElement('div');
    progress.className = 'embed-progress mb-3';
    progress.style.width = '100%';
    progress.style.height = '20px';
    progress.style.backgroundColor = '#f0f0f0';
    const progressBar = document.createElement('div');
    progressBar.style.width = `${this.props.stage.completionPercentage}%`;
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#007bff';
    progress.appendChild(progressBar);
    container.appendChild(progress);

    const controls = document.createElement('div');
    controls.className = 'controls';
    container.appendChild(controls);

    const backButton = document.createElement('button');
    backButton.disabled = this.props.isLoading || this.props.index === 0;
    backButton.className = `go-button back ${this.props.stage.key === STAGES[0].key ? 'hidden' : ''}`;
    backButton.textContent = 'Back';
    backButton.type = 'button';
    this.addEventListener(backButton, 'click', this.props.handleBackButtonClick);
    controls.appendChild(backButton);

    const nextButton = document.createElement('button');
    nextButton.className = `go-button next ${this.props.stage.actionButtonClassName || ''}`;
    nextButton.disabled = this.props.isLoading || !this.props.canBypassStage(this.props.stage);
    nextButton.type = 'button';
    this.addEventListener(nextButton, 'click', this.props.stage.completionPercentage === 100 ? this.closeAndSave.bind(this) : this.props.handleNextButtonClick);

    const icon = document.createElement('i');
    icon.className = this.props.stage.actionButtonIconClassName || 'hidden';
    nextButton.appendChild(icon);

    const caption = this.props.stage.actionButtonCaption
      || (this.props.stage.completionPercentage === 100 && this.props.stage.key === SERVICE_PROVIDER && 'Save and Close')
      || (this.props.stage.completionPercentage === 100 && 'Close')
      || 'Next';
    nextButton.appendChild(document.createTextNode(caption));

    controls.appendChild(nextButton);

    return container;
  }
}

CampaignStage.propTypes = {
  index: PropTypes.number.isRequired,
  stage: PropTypes.shape({
    key: PropTypes.string.isRequired,
    completionPercentage: PropTypes.number.isRequired,
    element: PropTypes.func.isRequired,
    actionButtonClassName: PropTypes.string,
    actionButtonIconClassName: PropTypes.string,
    actionButtonCaption: PropTypes.string,
    bootstrap: PropTypes.func,
  }),
  handleBackButtonClick: PropTypes.func.isRequired,
  handleNextButtonClick: PropTypes.func.isRequired,
  canBypassStage: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default CampaignStage;