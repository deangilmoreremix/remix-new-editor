import * as React from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import { useAsync } from 'react-async-hook';

import PropTypes from '../PropTypes';
import Lottie from './Lottie';
import { isValidJsonUrl } from '../popcorn/helpers';
import { loadUrl } from '../requestCreator';

const fetchAnimation = async (url) => new Promise((resolve, reject) => {
  if (isValidJsonUrl(url)) {
    resolve(url);
  } else {
    reject(new Error('Not correct URL'));
  }
}).then(loadUrl);

const LottiePlayer = observer(({ url, className }) => {
  const { result: animationData } = useAsync(fetchAnimation, [url]);

  const options = {
    loop: true,
    autoplay: true,
    animationData,
    renderer: 'svg',
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  if (!animationData) return null;

  return (
    <Lottie
      options={options}
      width="95%"
      height="auto"
      className={classnames(className, 'lottie-player')}
    />
  );
});

LottiePlayer.propTypes = {
  url: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default LottiePlayer;
