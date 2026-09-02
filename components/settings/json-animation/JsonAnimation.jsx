import lottie from 'lottie-web';

import Component from '../../base/Component';
import { BASIC, ADVANCED, POPCORN_ELEMENT_TYPES } from '../../../lib/constants/popcorn';
import Basic from '../default-tabs/Basic';
import Advanced from './tabs/Advanced';
import { loadUrl } from '../../../lib/requestCreator';

const TabMap = {
  [BASIC]: Basic,
  [ADVANCED]: Advanced,
};

export class JsonAnimation extends Component {
  constructor(props = {}) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleSetColors = this.handleSetColors.bind(this);
  }

  async handleChange(field) {
    const { element, update } = this.props;
    const { url } = field;
    if (element && (element.popcornOptions.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION
      || element.type === POPCORN_ELEMENT_TYPES.JSON_TRANSITION) && url) {
      const animationData = await loadUrl(url);
      const animation = await lottie.loadAnimation({ animationData });
      return update({
        url,
        end: element.popcornOptions.start + (animation.totalFrames / animation.animationData.fr),
      });
    }
    update(field);
  }

  handleSetColors(colors) {
    this.props.update({ colors });
  }

  get newAnimationFields() {
    const { fields, store } = this.props;
    const { isSuperAdmin } = store || {};
    return isSuperAdmin ? fields : { start: fields.start, end: fields.end };
  }

  get newTransitionFields() {
    const { fields, store } = this.props;
    const { isSuperAdmin } = store || {};
    const transitionFieldsWithoutEnd = { ...fields };
    delete transitionFieldsWithoutEnd.end;
    return isSuperAdmin ? transitionFieldsWithoutEnd : { start: fields.start };
  }

  render() {
    const { tab = BASIC, element, update, fields } = this.props;
    const Tab = TabMap[tab];

    const div = document.createElement('div');
    div.className = 'json-animation-form';

    if (element && element.popcornOptions) {
      const tabComponent = new Tab({
        options: element.popcornOptions,
        element,
        onChange: this.handleChange,
        fields: element.type === POPCORN_ELEMENT_TYPES.JSON_ANIMATION
          ? this.newAnimationFields
          : this.newTransitionFields,
        update,
      });
      div.appendChild(tabComponent.render());
    }

    if (element && element.popcornOptions && element.popcornOptions.url) {
      // Assume LottieEditor is converted
      const lottieDiv = document.createElement('div');
      lottieDiv.className = 'json-animation-preview';
      // Placeholder for LottieEditor
      lottieDiv.textContent = 'Lottie Editor Placeholder';
      div.appendChild(lottieDiv);
    }

    return div;
  }
}

export default JsonAnimation;
