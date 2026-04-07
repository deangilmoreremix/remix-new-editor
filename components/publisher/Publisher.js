import { Component } from '../base/Component.js';
import { getStore } from '../base/Store.js';
import { INITIAL_LOAD, MESSAGE_TOPICS } from '../../lib/constants/campaigns/constants.js';

export class Publisher extends Component {
  constructor(props = {}) {
    super(props);
    this.state = {
      isLoaded: false,
      isLoading: false,
    };
    this.conductorRef = null;
    this.commonStore = getStore('commonStore');
    this.childrenFunction = props.children;
  }

  onMount() {
    if (!this.props.withIframe || this.conductorRef) {
      this.setState({ isLoaded: true });
    }

    if (this.conductorRef) {
      this.addEventListener(this.conductorRef, 'load', this.sendInitMessage.bind(this));
    }
  }

  onUnmount() {
    if (this.conductorRef) {
      this.conductorRef.removeEventListener('load', this.sendInitMessage.bind(this));
    }
  }

  sendInitMessage() {
    if (this.conductorRef && this.conductorRef.contentWindow) {
      this.conductorRef.contentWindow.postMessage({
        topic: INITIAL_LOAD,
        config: {},
        topics: MESSAGE_TOPICS,
        parentWindowUrl: window.location.origin + window.location.pathname,
      }, this.conductorRef.src);
    }
  }

  postResponsiveMessage(data) {
    this.setState({ isLoading: true });
    const messageId = `${Date.now()}/${Math.random()}`;

    return new Promise((resolve, reject) => {
      const receiver = ({ data: messageData }) => {
        if (messageData.messageId !== messageId) {
          return;
        }
        window.removeEventListener('message', receiver);
        if (messageData.error) {
          reject(messageData.error);
          this.setState({ isLoading: false });
        } else {
          resolve(messageData);
          this.setState({ isLoading: false });
        }
      };
      window.addEventListener('message', receiver);
    }).then(() => {
      if (this.conductorRef && this.conductorRef.contentWindow) {
        this.conductorRef.contentWindow.postMessage({
          messageId,
          topic: data.topic,
          source: data.source,
          arguments: data.arguments,
        }, this.conductorRef.src);
      }
    });
  }

  collapseConductor() {
    if (this.conductorRef) {
      this.conductorRef.style.width = '1px';
      this.conductorRef.style.height = '1px';
    }
  }

  expandConductor() {
    if (this.conductorRef) {
      this.conductorRef.style.width = '100%';
      this.conductorRef.style.height = '100%';
      this.conductorRef.style.zIndex = '11000';
      this.conductorRef.style.position = 'fixed';
      this.conductorRef.style.top = '0';
      this.conductorRef.style.left = '0';
    }
  }

  render() {
    const container = document.createElement('div');
    container.className = 'social-campaign';

    if (this.state.isLoaded && this.childrenFunction) {
      const childProps = {
        postResponsiveMessage: this.postResponsiveMessage.bind(this),
        collapseConductor: this.collapseConductor.bind(this),
        expandConductor: this.expandConductor.bind(this),
        isLoading: this.state.isLoading,
        setLoading: (loading) => this.setState({ isLoading: loading }),
      };
      const childElement = this.childrenFunction(childProps);
      if (childElement instanceof HTMLElement) {
        container.appendChild(childElement);
      }
    }

    if (this.props.withIframe) {
      const iframe = document.createElement('iframe');
      iframe.title = 'Iframe social conductor';
      iframe.src = `${this.commonStore.cdnSocialWeb}/social-campaign/social-campaign.html`;
      iframe.frameBorder = '0';
      iframe.className = 'conductor-iframe';
      iframe.id = 'conductor-iframe';
      this.conductorRef = iframe;
      container.appendChild(iframe);
    }

    return container;
  }
}

Publisher.defaultProps = {
  withIframe: true,
};

export default Publisher;