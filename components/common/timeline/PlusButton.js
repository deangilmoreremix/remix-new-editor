import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';

const plusIcon = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 23.0.2, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Слой_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 22.4 22.4" style="enable-background:new 0 0 22.4 22.4;" xml:space="preserve">
<style type="text/css">
	.st0{clip-path:url(#SVGID_2_);}
	.st1{fill:none;stroke:#EB5054;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}
	.st2{fill:#E4E4EC;}
</style>
<g>
	<defs>
		<rect id="SVGID_1_" width="22.4" height="22.4"/>
	</defs>
	<clipPath id="SVGID_2_">
		<use xlink:href="#SVGID_1_"  style="overflow:visible;"/>
	</clipPath>
	<g class="st0">
		<path class="st1" d="M18.4,21.9H4c-1.9,0-3.5-1.6-3.5-3.5V4c0-1.9,1.6-3.5,3.5-3.5h14.3c1.9,0,3.5,1.6,3.5,3.5v14.3
			C21.9,20.3,20.3,21.9,18.4,21.9z"/>
		<path class="st2" d="M18.4,10h-6V4H10v6H4v2.4h6v6h2.4v-6h6V10z"/>
	</g>
</g>
</svg>`;

export class PlusButton extends Component {
  constructor(props = {}) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    if (this.props.onClick) {
      this.props.onClick();
    }
  }

  render() {
    const className = this.props.className || '';
    const alt = this.props.alt || '';
    const html = `<button class="${className}" aria-label="${alt}" data-tip="${alt}">${plusIcon}</button>`;
    const element = this.createElementFromHTML(html);
    this.addEventListener(element, 'click', this.handleClick);
    return element;
  }
}