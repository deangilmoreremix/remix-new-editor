import { Component } from '../../base/Component.js';
import { getStore } from '../../base/Store.js';
import { ProjectLoader } from '../../common/ProjectLoader.js';
import { generatePopcornObject } from '../../../lib/utils/popcorn-helper.js';
import { userFriendlyTokens } from '../../../lib/constants/tokens.js';
import { DEFAULT_USER_IMAGE } from '../../../lib/constants/project.js';

export class IframePlayer extends Component {
  constructor(props = {}) {
    super(props);
    this.containerClassName = props.containerClassName || 'iframe-container';
    this.videoClassName = props.videoClassName || 'video-player';
    this.item = props.item;

    this.projectStore = getStore('projectStore');
    this.commonStore = getStore('commonStore');

    this.frameRef = `${Date.now()}/${Math.random()}`;
    this.state = { isLoading: true };
  }

  onMount() {
    this.setupIframe();
  }

  setupIframe() {
    const parsedProject = JSON.parse(this.item.project.data);
    const personalization = this.projectStore.getPersonalization(parsedProject.media);
    const queryParams = personalization.map(param => {
      const fallback = userFriendlyTokens[param] || param;
      return `${param}=${fallback}`;
    });
    const queryString = `${queryParams.join('&')}&IMAGE${DEFAULT_USER_IMAGE}`;

    this.addDocumentListener('message', this.preplayHandler.bind(this));

    // Set iframe src
    const iframe = this.element.querySelector('iframe');
    iframe.src = `${this.item.url}?preplay=postMessage&preplayId=${this.frameRef}&${queryString}`;
  }

  preplayHandler(event) {
    const { source: frameConductor, data: { topic, preplayId } } = event;
    if (topic !== 'preplay' || preplayId !== this.frameRef || !frameConductor) {
      return;
    }

    this.removeDocumentListener('message', this.preplayHandler);

    frameConductor.postMessage({
      topic: 'preplay',
      config: {
        domain: this.commonStore.whiteLabelManager.domain,
        serviceName: 'VidCloud',
        salesPage: '',
        privacyPolicyLink: '',
        hideSalesPage: true,
        hidePlaybackLogo: true,
        hideCopyButton: true,
        showExtendedEndroll: false,
        showShare: false,
        hasPersonalizedVoice: false,
        allowedSocials: [],
        thumbnail: this.item.thumbnail,
        editor: 'revolution',
        data: generatePopcornObject(JSON.parse(this.item.project.data)),
        title: this.item.title,
      },
    }, this.item.url);
    this.setState({ isLoading: false });
  }

  render() {
    const html = `
      <div class="${this.containerClassName}">
        ${this.state.isLoading ? new ProjectLoader().render().outerHTML : ''}
        <iframe class="${this.videoClassName}" title="${this.item.title}" frameborder="0" allow="autoplay; fullscreen" mozallowfullscreen="true" webkitallowfullscreen="true" scrolling="no" allowfullscreen></iframe>
      </div>
    `;
    return this.createElementFromHTML(html);
  }
}

export default IframePlayer;