import { Component } from '../../../base/Component.js';
import { CANVAS_SIZES } from '../../../lib/constants/media';
import Menu from '../Menu.js';

const SIZE_STRINGS = CANVAS_SIZES.map(item => ({
  title: `${item.width}/${item.height}`,
  value: { width: item.width, height: item.height },
}));

const listValues = [
  { title: 'All ratios' },
  ...SIZE_STRINGS,
];

export class RatioList extends Component {
  constructor(props = {}) {
    super(props);

    this.state = {
      onChangeRatio: props.onChangeRatio,
      activeElement: listValues[0].title,
    };

    this.onClick = this.onClick.bind(this);
  }

  onClick(value) {
    const key = value ? `${value.width}/${value.height}` : listValues[0].title;
    this.setState({ activeElement: key });
    this.state.onChangeRatio(value);
  }

  render() {
    const { activeElement } = this.state;

    const items = listValues.filter(item => item.title !== activeElement);

    const menu = new Menu({
      toggleElement: `<span class="ratio-title">${activeElement}</span>`,
      items,
      className: 'ratio',
      lineDropIcon: true,
      needEndIcon: true,
      onClick: this.onClick,
    });

    const html = `<div>${menu.render().outerHTML}</div>`;

    return this.createElementFromHTML(html);
  }
}
