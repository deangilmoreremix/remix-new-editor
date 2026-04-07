import { Component } from '../../../../base/Component.js';
import PropTypes from '../../../../../lib/PropTypes.js';

export class EmbedLocation extends Component {
  render() {
    const container = document.createElement('div');
    container.className = 'embed-location';

    const title = document.createElement('h5');
    title.className = 'embed-title';
    title.textContent = 'URL Link to your page with your embedded video';
    container.appendChild(title);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'embed-page-input';
    input.value = this.props.settings.embedPage || '';
    this.addEventListener(input, 'change', (event) => {
      this.props.updateCampaign({ embedPage: event.target.value });
    });
    container.appendChild(input);

    return container;
  }
}

EmbedLocation.propTypes = {
  settings: PropTypes.shape({
    embedPage: PropTypes.string,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
};

export default EmbedLocation;