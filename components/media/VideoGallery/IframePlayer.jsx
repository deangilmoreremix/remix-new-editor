import React from 'react';
import PropTypes from 'prop-types';
import { observer } from 'mobx-react';

import ProjectLoader from '../../common/ProjectLoader';

import useProjectStore from '../../hooks/useProjectStore';
import useCommonStore from '../../hooks/useCommonStore';

import { generatePopcornObject } from '../../../lib/utils/popcorn-helper';

import { userFriendlyTokens } from '../../../lib/constants/tokens';
import { DEFAULT_USER_IMAGE } from '../../../lib/constants/project';


const IframePlayer = (props) => {
  const projectStore = useProjectStore();
  const common = useCommonStore();

  const { getPersonalization } = projectStore;

  const { containerClassName, videoClassName, item: { url, title }, item } = props;

  const frameRef = React.useRef(`${Date.now()}/${Math.random()}`);

  const [isLoading, setIsLoading] = React.useState(true);

  const parsedProject = React.useMemo(() => JSON.parse(item.project.data),
    [item.project.data]);

  const personalization = React.useMemo(() => getPersonalization(parsedProject.media),
    [parsedProject]);

  const queryParams = React.useMemo(() => personalization.map(param => {
    const fallback = userFriendlyTokens[param] || param;
    return `${param}=${fallback}`;
  }), [personalization]);

  const queryString = React.useMemo(() => `${queryParams
    .join('&')}&IMAGE${DEFAULT_USER_IMAGE}`, [queryParams]);

  const preplayHandler = (event) => {
    const { source: frameConductor, data: { topic, preplayId } } = event;
    if (topic !== 'preplay' || preplayId !== frameRef.current || !frameConductor) {
      return;
    }

    window.removeEventListener('message', preplayHandler);
    frameConductor.postMessage({
      topic: 'preplay',
      config: {
        domain: common.whiteLabelManager.domain,
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
        thumbnail: item.thumbnail,
        editor: 'revolution',
        data: generatePopcornObject(parsedProject),
        title: item.title,
      },
    }, url);
    setIsLoading(false);
  };

  React.useEffect(() => {
    if (frameRef?.current) {
      window.addEventListener('message', preplayHandler);
    }
  }, [frameRef?.current]);

  return (
    <div className={containerClassName}>
      { isLoading && <ProjectLoader /> }
      <iframe
        className={videoClassName}
        title={title}
        src={`${url}?preplay=postMessage&preplayId=${frameRef.current}&${queryString}`}
        frameBorder="0"
        allow="autoplay; fullscreen"
        mozallowfullscreen="true"
        webkitallowfullscreen="true"
        scrolling="no"
        allowFullScreen
      />
    </div>
  );
};

IframePlayer.propTypes = {
  videoClassName: PropTypes.string,
  containerClassName: PropTypes.string,
  item: PropTypes.shape({
    title: PropTypes.string,
    url: PropTypes.string.isRequired,
    thumbnail: PropTypes.string,
    project: PropTypes.shape({ data: PropTypes.string.isRequired }).isRequired,
  }).isRequired,
};

IframePlayer.defaultProps = {
  videoClassName: 'video-player',
  containerClassName: 'iframe-container',
};

export default observer(IframePlayer);
