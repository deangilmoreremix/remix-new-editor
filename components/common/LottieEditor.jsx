import * as React from 'react';
import isEmpty from 'lodash/isEmpty';
import { useAsync } from 'react-async-hook';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import Lottie from '../../lib/lottie/Lottie';
import FormColor from '../form/FormColor';
import { rgbToHex, getColors, setColors } from '../../lib/lottie/utils';
import { colorToRgbaString, parseRgbaString } from '../../lib/utils/color';
import { isValidJsonUrl } from '../../lib/popcorn/helpers';
import { loadUrl } from '../../lib/requestCreator';

import playIcon from '../../public/static/svgImages/common/play.svg';
import stopIcon from '../../public/static/svgImages/common/stop.svg';
import pauseIcon from '../../public/static/svgImages/common/pause.svg';

const fetchAnimation = async (url) => new Promise((resolve, reject) => {
  if (isValidJsonUrl(url)) {
    resolve(url);
  } else {
    reject(new Error('Not correct URL'));
  }
}).then(loadUrl);

const LottieEditor = ({
  showControls,
  file,
  setColor,
  segments = {},
  value = [],
  className,
  showPreview,
  formColorClassName,
  isLabel,
}) => {
  const [isStopped, setIsStopped] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [colors, storeColors] = React.useState();

  const animationElement = React.useRef(null);

  const { result: animation } = useAsync(fetchAnimation, [file]);

  const icon = React.useMemo(() => (!isStopped ? stopIcon : playIcon), [isStopped]);

  React.useEffect(() => {
    if (value && value.length) {
      storeColors(value);
    }
  }, [value]);

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

      storeColors(rows);
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
    setColor(newColors);
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

  const handleStop = () => {
    setIsStopped(!isStopped);
    setIsPaused(false);
  };

  const completeAnimation = () => {
    setIsStopped(true);
  };

  return (
    <React.Fragment>
      {showColors && showColors.length
        ? showColors.map((oldColor, i) => (
          <FormColor
            key={oldColor}
            value={oldColor}
            onChange={(newColor) => pickColor(newColor, oldColor)}
            className={formColorClassName}
            label={isLabel ? `Lower Third color ${i + 1}` : null}
          />
        ))
        : null}
      {!isEmpty(preparedAnimation) && options && showPreview && (
        <Lottie
          ref={animationElement}
          options={options}
          isStopped={isStopped}
          isPaused={isPaused}
          eventListeners={[
            { eventName: 'DOMLoaded', callback: load },
            { eventName: 'complete', callback: completeAnimation },
          ]}
          speed={1}
          looped={false}
          className={className}
        />
      )}
      {showControls && (
        <div className="lottie-controls">
          <SVGInline
            onClick={handleStop}
            component="button"
            className="icon-button timeline-play"
            classSuffix=""
            svg={icon}
            cleanup={['title']}
          />
          <SVGInline
            onClick={() => setIsPaused(!isPaused)}
            component="button"
            className="icon-button timeline-play"
            classSuffix=""
            svg={pauseIcon}
            cleanup={['title']}
          />
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
  className: PropTypes.string,
  formColorClassName: PropTypes.string,
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
  showPreview: PropTypes.bool,
  isLabel: PropTypes.bool,
};

LottieEditor.defaultProps = {
  showPreview: true,
};

export default LottieEditor;
