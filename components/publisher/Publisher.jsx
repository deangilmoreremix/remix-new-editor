import * as React from 'react';

import PropTypes from '../../lib/PropTypes';

import { INITIAL_LOAD, MESSAGE_TOPICS } from '../../lib/constants/campaigns/constants';

const Publisher = ({ children, withIframe }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const conductorRef = React.useRef(null);

  // TODO: refactor Loading spinner in the future
  const [isLoading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!withIframe || (conductorRef && conductorRef.current)) {
      setIsLoaded(true);
    }
  }, []);

  const conductor = conductorRef.current;

  React.useEffect(() => {
    if (conductor) {
      conductor.addEventListener('load', sendInitMessage);
    }
    return () => conductor && conductor.removeEventListener('load', sendInitMessage);
  }, [conductor]);

  const sendInitMessage = React.useCallback(() => {
    conductor.contentWindow.postMessage({
      topic: INITIAL_LOAD,
      config: {},
      topics: MESSAGE_TOPICS,
      parentWindowUrl: window.location.origin + window.location.pathname,
    }, conductor.src);
  }, [conductor]);

  const postResponsiveMessage = (data) => {
    setLoading(true);
    const messageId = `${Date.now()}/${Math.random()}`;

    const result = new Promise((resolve, reject) => {
      const receiver = ({ data: messageData }) => {
        if (messageData.messageId !== messageId) {
          return;
        }
        window.removeEventListener('message', receiver);
        if (messageData.error) {
          reject(messageData.error);
          setLoading(false);
        } else {
          resolve(messageData);
          setLoading(false);
        }
      };
      window.addEventListener('message', receiver);
    });

    conductor.contentWindow.postMessage({
      messageId,
      topic: data.topic,
      source: data.source,
      arguments: data.arguments,
    }, conductor.src);
    return result;
  };

  const collapseConductor = () => {
    conductor.style.width = '1px';
    conductor.style.height = '1px';
  };

  const expandConductor = () => {
    conductor.style.width = '100%';
    conductor.style.height = '100%';
    conductor.style.zIndex = '11000';
    conductor.style.position = 'fixed';
    conductor.style.top = 0;
    conductor.style.left = 0;
  };

  return (
    <div className="social-campaign">
      {
        isLoaded && children({
          postResponsiveMessage,
          collapseConductor,
          expandConductor,
          isLoading,
          setLoading,
        })
      }
      {withIframe && (
        <iframe
          title="Iframe social conductor"
          src="https://cdn.videoremix.io/social-campaign/social-campaign.html"
          frameBorder="0"
          className="conductor-iframe"
          id="conductor-iframe"
          ref={conductorRef}
        />
      )}
    </div>
  );
};

Publisher.defaultProps = {
  withIframe: true,
};

Publisher.propTypes = {
  children: PropTypes.func.isRequired,
  withIframe: PropTypes.bool,
};

export default Publisher;
