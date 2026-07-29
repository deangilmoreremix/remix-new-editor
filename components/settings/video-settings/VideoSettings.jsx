import Component from '../../base/Component';
import { CLIP_EDITOR_TAB } from '../../../lib/constants/popcorn';
import ClipEditor from './tabs/ClipEditor';

const TabMap = {
  [CLIP_EDITOR_TAB]: ClipEditor,
};

export class VideoSettings extends Component {
  constructor(props = {}) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(value, options) {
    let newOptions = { ...value };
    if (options) {
      newOptions = { ...newOptions, ...options };
    }
    this.props.update(newOptions);
  }

  render() {
    const { tab = CLIP_EDITOR_TAB, element, fields } = this.props;
    const Tab = TabMap[tab];
    const div = document.createElement('div');
    div.className = 'video-settings-form';
    if (element && element.popcornOptions) {
      const tabComponent = new Tab({
        values: element.popcornOptions,
        onChange: (field, options) => this.handleChange(field, options),
        fields,
        element,
      });
      div.appendChild(tabComponent.render());
    }
    return div;
  }
}

export default VideoSettings;
