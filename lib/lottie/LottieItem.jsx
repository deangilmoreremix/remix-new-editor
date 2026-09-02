import React, { useEffect, useRef, useState } from 'react';
import { useAsync } from 'react-async-hook';

import PropTypes from '../PropTypes';
import { fileReader } from '../utils/fileReader';
import { isValidJsonUrl } from '../popcorn/helpers';
import { loadUrl } from '../requestCreator';

import Lottie from './Lottie';

const fetchAnimation = async (url) => new Promise((resolve, reject) => {
  if (isValidJsonUrl(url)) {
    resolve(url);
  } else {
    reject(new Error('Not correct URL'));
  }
}).then(loadUrl);

const LottieItem = ({ items, setFilesToUpload, isReady, url }) => {
  const [images, setImages] = useState();
  const [previews, setPreviews] = useState();
  const animationElement = useRef(null);

  const { result: animation } = useAsync(fetchAnimation, [url]);

  useEffect(() => {
    if (!isReady && previews) {
      if (items && items.length) {
        const newArr = [];
        items.forEach((item, i) => {
          newArr.push({ data: item, preview: previews[i] });
        });
        setFilesToUpload(newArr);
      }

      if (url) {
        const json = JSON.stringify(images[0].data);
        const blob = new Blob([json], { type: 'application/json' });
        setFilesToUpload([{
          data: new File([blob], Date.now(), { type: 'application/json' }),
          preview: previews[0],
        }]);
      }
    }
  }, [previews]);

  useEffect(() => {
    if (items && items.length) {
      (async () => {
        const promise = Promise.resolve();
        const elements = await Promise.all(items.map(file => (
          promise.then(async () => {
            const data = await fileReader(file);
            return { data: JSON.parse(data) };
          }))));
        setImages(elements);
      })();
    }

    if (animation) {
      (async () => {
        const element = { data: animation };
        setImages([element]);
      })();
    }
  }, [items, animation]);

  const load = () => {
    const { anim } = animationElement.current;
    anim.goToAndStop(anim.totalFrames / 2, true);

    const canvas = document.querySelectorAll('.stickers-content__lottie canvas');

    const prewImg = [];
    canvas.forEach(item => {
      prewImg.push(item.toDataURL());
    });

    if (!previews) {
      setPreviews(prewImg);
    }
  };

  if (!items && !url) {
    return null;
  }

  return (
    <div className="stickers-content__lottie">
      {
        images && images.length && images.map((image, i) => {
          const defaultOptions = {
            loop: true,
            autoplay: false,
            animationData: image.data,
            renderer: 'canvas',
            rendererSettings: {
              preserveAspectRatio: 'xMidYMid slice',
            },
          };

          const key = items ? items[i].name : i;

          return (
            <Lottie
              key={key}
              options={defaultOptions}
              width="95%"
              height="95%"
              className="stickers-content__img"
              ref={animationElement}
              eventListeners={[{ eventName: 'DOMLoaded', callback: load }]}
              isStopped
            />
          );
        })
      }
    </div>
  );
};

LottieItem.propTypes = {
  items: PropTypes.arrayOrObservableArray,
  setFilesToUpload: PropTypes.func.isRequired,
  isReady: PropTypes.bool.isRequired,
  url: PropTypes.string,
};

export default LottieItem;
