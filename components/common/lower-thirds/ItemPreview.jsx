import React from 'react';
import { useAsync } from 'react-async-hook';

import PropTypes from '../../../lib/PropTypes';
import { isValidJsonUrl } from '../../../lib/popcorn/helpers';
import { loadUrl } from '../../../lib/requestCreator';

import Lottie from '../../../lib/lottie/Lottie';

const fetchAnimation = async (url) => new Promise((resolve, reject) => {
  if (isValidJsonUrl(url)) {
    resolve(url);
  } else {
    reject(new Error('Not correct URL'));
  }
}).then(loadUrl);

const ItemPreview = ({ item }) => {
  const { result: animation } = useAsync(fetchAnimation, [item.data]);

  const options = React.useMemo(() => ({
    loop: true,
    autoplay: true,
    animationData: animation,
    rendererSettings: {
      viewBoxOnly: false,
      preserveAspectRatio: 'xMidYMid slice',
    },
  }), [animation]);

  return (
    <Lottie
      options={options}
      speed={1}
      looped={false}
      className="lower-thirds-content__preview"
    />
  );
};

ItemPreview.propTypes = {
  item: PropTypes.shape({
    data: PropTypes.string.isRequired,
  }).isRequired,
};

export default ItemPreview;
