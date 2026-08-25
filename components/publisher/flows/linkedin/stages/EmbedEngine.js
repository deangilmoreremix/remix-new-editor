import { Component } from '../../../../base/Component.js';
import PropTypes from '../../../../../lib/PropTypes.js';
import { DEFAULT, EMBED_LOCATIONS } from '../../../../../lib/constants/campaigns/constants.js';
import EmbedDataContainer from '../../../EmbedDataContainer.js';

export class EmbedEngine extends Component {
  render() {
    const container = document.createElement('div');
    container.className = 'embed-engine';

    const title = document.createElement('h5');
    title.className = 'embed-title';
    title.textContent = 'Where do you want to embed your video?';
    container.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'embed-grid';
    container.appendChild(grid);

    const embedGroup1 = document.createElement('div');
    embedGroup1.className = 'row embed-group';
    grid.appendChild(embedGroup1);

    const label1 = document.createElement('label');
    label1.className = 'cell';
    label1.htmlFor = 'embed-location-select';
    label1.textContent = 'Embed Location';
    embedGroup1.appendChild(label1);

    if (this.props.settings.embedLocation) {
      const select = document.createElement('select');
      select.className = 'cell';
      select.name = 'select';
      select.id = 'embed-location-select';
      select.value = this.props.settings.embedLocation.key;
      this.addEventListener(select, 'change', (event) => {
        const embedLocation = EMBED_LOCATIONS.find(item => item.key === event.target.value);
        this.props.updateCampaign({ embedLocation });
      });

      EMBED_LOCATIONS.forEach(({ key, label }) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        select.appendChild(option);
      });

      embedGroup1.appendChild(select);
    }

    const embedGroup2 = document.createElement('div');
    embedGroup2.className = 'row embed-group';
    grid.appendChild(embedGroup2);

    const label2 = document.createElement('label');
    label2.className = 'cell';
    label2.htmlFor = 'preload-check';
    label2.textContent = 'Preload';
    embedGroup2.appendChild(label2);

    const checkbox = document.createElement('input');
    checkbox.className = 'cell';
    checkbox.type = 'checkbox';
    checkbox.id = 'preload-check';
    checkbox.checked = this.props.settings.preload;
    this.addEventListener(checkbox, 'change', (event) => {
      this.props.updateCampaign({ preload: event.target.checked });
    });
    embedGroup2.appendChild(checkbox);

    if (this.props.settings.embedLocation) {
      const details = document.createElement('div');
      details.className = this.props.settings.embedLocation.embedGenerator ? 'embed-details' : 'hidden';
      container.appendChild(details);

      const span = document.createElement('span');
      span.className = 'embed-line';
      span.textContent = this.props.settings.embedLocation.prompt;
      details.appendChild(span);

      if (this.props.settings.embedLocation.key !== DEFAULT) {
        const embedContainer = new EmbedDataContainer({
          className: 'embed-item',
          url: `${this.props.project.url}?${[!this.props.settings.preload ? 'preload=none' : null].filter(item => !!item).join('&')}`,
          stringGenerator: this.props.settings.embedLocation.embedGenerator,
          resizable: true,
        });
        details.appendChild(embedContainer.render());
      }
    }

    return container;
  }
}

EmbedEngine.propTypes = {
  settings: PropTypes.shape({
    facebookPageTab: PropTypes.shape({
      name: PropTypes.string,
    }),
    facebookPages: PropTypes.array,
    selectedFbPage: PropTypes.string,
    embedLocation: PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      prompt: PropTypes.string,
      embedGenerator: PropTypes.func,
    }),
    preload: PropTypes.bool,
  }).isRequired,
  project: PropTypes.shape({
    url: PropTypes.string.isRequired,
  }).isRequired,
  updateCampaign: PropTypes.func.isRequired,
  provider: PropTypes.shape({
    logIn: PropTypes.func.isRequired,
  }).isRequired,
};

export default EmbedEngine;