import * as React from 'react';
import isEmpty from 'lodash/isEmpty';
import { useAsync } from 'react-async-hook';

import PropTypes from '../../lib/PropTypes';
import Lottie from '../../lib/lottie/Lottie';
import FormColor from '../form/FormColor';
import { rgbToHex, getColors, setColors, getDimensions } from '../../lib/lottie/utils';
import { colorToRgbaString, parseRgbaString } from '../../lib/utils/color';
import { isValidJsonUrl } from '../../lib/popcorn/helpers';
import { loadUrl } from '../../lib/requestCreator';

const baseDimension = 150;

const fetchAnimation = async (url) => new Promise((resolve, reject) => {
  if (isValidJsonUrl(url)) {
    resolve(url);
  } else {
    reject(new Error('Not correct URL'));
  }
}).then(loadUrl);

const LottieEditor = ({ showControls, file, setColor, segments = {}, value = [] }) => {
  const [ratio, setRatio] = React.useState(1);
  const [isStopped, setIsStopped] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [colors, storeColors] = React.useState(value);

  const animationElement = React.useRef(null);

  const { result: animation } = useAsync(fetchAnimation, [file]);

  // TODO: left here for the future segments playback
  const load = () => {
    const { anim } = animationElement.current;
    // Play initial segment
    // Should be a proper range, e.g. [0, 1] or [24, 25]
    // [0, 0] or [24, 24] won't work
    if (isEmpty(segments)) {
      anim.play();
    } else {
      anim.playSegments(segments, true);
    }
  };

  React.useEffect(() => {
    // Recalculate original animation colors
    const rows = [];

    const { ratio: jsonRatio } = getDimensions(animation) || {};
    setRatio(jsonRatio);

    if (!value.length) {
      if (animation && animation.layers) {
        getColors(animation.layers, color => rows.push(color));
      }

      if (animation && animation.assets) {
        animation.assets.forEach((asset, i) => getColors(
          asset.layers,
          color => rows.push(color), i),
        );
      }

      setTimeout(() => storeColors(rows), 0);
    }
  }, [animation]);

  const pickColor = (newColor, oldColor) => {
    const newRgb = parseRgbaString(newColor);
    const oldRgb = parseRgbaString(oldColor);

    const newColors = colors.map(c => {
      const shouldUpdate = Object.keys(oldRgb).every(key => c[key] === oldRgb[key]);

      if (shouldUpdate) {
        const { r, g, b } = newRgb;
        const hex = rgbToHex(r, g, b);
        return { ...c, color: hex, ...newRgb };
      }

      return c;
    });
    storeColors(newColors);
  };

  const preparedAnimation = React.useMemo(
    () => {
      let coloredAnimation;

      if (animation && colors && colors.length) {
        coloredAnimation = setColors(animation, colors);
      }

      return coloredAnimation || animation;
    },
    [animation, colors],
  );

  React.useEffect(() => {
    if (colors && colors.length) {
      setColor(colors);
    }
  }, [colors]);

  const showColors = React.useMemo(() => {
    const result = new Set();

    if (colors && colors.length) {
      colors.forEach(color => {
        result.add(colorToRgbaString(color));
      });
    }

    return Array.from(result);
  }, [colors]);

  const options = React.useMemo(() => ({
    loop: false,
    autoplay: true,
    animationData: preparedAnimation,
    rendererSettings: {
      viewBoxOnly: false,
      preserveAspectRatio: 'xMidYMid slice',
    },
  }), [preparedAnimation]);

  return (
    <React.Fragment>
      {showColors && showColors.length
        ? showColors.map((oldColor) => (
          <FormColor
            key={oldColor}
            value={oldColor}
            onChange={(newColor) => pickColor(newColor, oldColor)}
          />
        ))
        : null}
      {!isEmpty(preparedAnimation) && options && (
        <Lottie
          ref={animationElement}
          options={options}
          height={baseDimension}
          width={ratio * baseDimension}
          isStopped={isStopped}
          isPaused={isPaused}
          eventListeners={[{ eventName: 'DOMLoaded', callback: load }]}
          speed={1}
          looped={false}
        />
      )}
      {showControls && (
        <div className="lottie-controls">
          <button
            type="button"
            onClick={() => setIsStopped(!isStopped)}
          >
            {isStopped ? 'play' : 'stop'}
          </button>
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
          >
            pause
          </button>
        </div>
      )}
    </React.Fragment>
  );
};

LottieEditor.propTypes = {
  showControls: PropTypes.bool,
  file: PropTypes.string.isRequired,
  setColor: PropTypes.func,
  segments: PropTypes.shape({}),
  value: PropTypes.arrayOf(
    PropTypes.shape({
      a: PropTypes.number,
      asset: PropTypes.number,
      b: PropTypes.number,
      color: PropTypes.string,
      g: PropTypes.number,
      i: PropTypes.number,
      j: PropTypes.number,
      k: PropTypes.number,
      nm: PropTypes.string,
      r: PropTypes.number,
    }),
  ),
};

export default LottieEditor;
