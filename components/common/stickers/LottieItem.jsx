import React, { useEffect, useRef, useState } from 'react';

import PropTypes from '../../../lib/PropTypes';
import { fileReader } from '../../../lib/utils/fileReader';

import Lottie from '../../../lib/lottie/Lottie';


const LottieItem = ({ items, setFilesToUpload, isReady }) => {
  const [images, setImages] = useState();
  const [previews, setPreviews] = useState();
  const animationElement = useRef(null);

  useEffect(() => {
    if (!isReady && previews) {
      const newArr = [];
      items.forEach((item, i) => {
        newArr.push({ data: item, preview: previews[i] });
      });
      setFilesToUpload(newArr);
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
  }, [items]);

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

  if (!items || !items.length) {
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

          return (
            <Lottie
              key={items[i].name}
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
};

export default LottieItem;
