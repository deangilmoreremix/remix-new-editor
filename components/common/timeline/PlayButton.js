import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';

const playIcon = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 23.0.2, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Play_svg_layer-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 22.4 22.4" style="enable-background:new 0 0 22.4 22.4;" xml:space="preserve">
<style type="text/css">
	.Play_svg_st0{clip-path:url(#SVGID_2_);}
	.Play_svg_st1{fill:none;stroke:#EB5054;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}
	.Play_svg_st2{fill:#E4E4EC;}
</style>
<g>
	<defs>
		<rect id="SVGID_1_" width="22.4" height="22.4"/>
	</defs>
	<clipPath id="SVGID_2_">
		<use xlink:href="#SVGID_1_"  style="overflow:visible;"/>
	</clipPath>
	<g class="Play_svg_st0">
		<path class="Play_svg_st1" d="M18.4,21.9H4c-1.9,0-3.5-1.6-3.5-3.5V4c0-1.9,1.6-3.5,3.5-3.5h14.3c1.9,0,3.5,1.6,3.5,3.5v14.3
			C21.9,20.3,20.3,21.9,18.4,21.9z"/>
		<path class="Play_svg_st2" d="M7.1,11.3V5.1l5.3,3.1l5.4,3.1l-5.4,3.1l-5.3,3.1V11.3z"/>
	</g>
</g>
</svg>`;

const pauseIcon = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22.4 22.4"><defs><style>.cls-1{fill:none;stroke:#eb5054;stroke-linecap:round;stroke-linejoin:round;}.cls-2{fill:#e4e4ec;}</style></defs><title>pause</title><rect class="cls-1 timeline-pause-icon" x="0.5" y="0.5" width="21.4" height="21.4" rx="3.52"/><rect class="cls-2" x="5.88" y="3.98" width="2.37" height="14.43" rx="1.19"/><rect class="cls-2" x="14.15" y="3.98" width="2.37" height="14.43" rx="1.19"/></svg>`;

export class PlayButton extends Component {
  constructor(props = {}) {
    super(props);
    this.projectStore = getStore('projectStore');
    this.handleClick = this.handleClick.bind(this);
    this.subscribeToStore(this.projectStore, () => this.update());
  }

  handleClick() {
    const { endDateWithZoom, startDate } = this.props;
    const { isPlayed, playPause, updateTime, time } = this.projectStore.getState();

    if (time * 10 > endDateWithZoom.diff(startDate)) {
      updateTime(endDateWithZoom.diff(startDate) / 10);
    }
    playPause();
  }

  render() {
    const { isPlayed, isLoadingSequencer } = this.projectStore.getState();
    const icon = isPlayed ? pauseIcon : playIcon;
    const disabled = isLoadingSequencer;
    const html = `<button class="icon-button timeline-play" ${disabled ? 'disabled' : ''}>${icon}</button>`;
    const element = this.createElementFromHTML(html);
    if (!disabled) {
      this.addEventListener(element, 'click', this.handleClick);
    }
    return element;
  }
}