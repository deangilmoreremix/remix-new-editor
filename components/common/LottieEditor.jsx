import * as React from 'react';
import isEmpty from 'lodash/isEmpty';

import PropTypes from '../../lib/PropTypes';
import Lottie from '../../lib/lottie/Lottie';
import FormColor from '../form/FormColor';
import { getColors, getDimensions, hexToRgb, toUnitVector } from '../../lib/lottie/utils';

const baseDimension = 150;

const LottieEditor = ({ showControls, file, /* setColor, */ segments = {} }) => {
  const [ratio, setRatio] = React.useState(1);
  const [isStopped, setIsStopped] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [animation, setAnimation] = React.useState(null);
  const [colors, setColors] = React.useState([]);

  const animationElement = React.useRef(null);

  // TODO: left here for the future segments playback
  const load = () => {
    const { anim } = animationElement.current;
    // Play initial segment
    // Should be a proper range, e.g. [0, 1] or [24, 25]
    // [0, 0] or [24, 24] won't work
    if (isEmpty(segments)) {
      anim.play();
    } else {
      // segments = [25, 0];
      anim.playSegments(segments, true);
    }
  };

  React.useEffect(
    // Refresh original animation object on each URL change
    () => {
      if (file) {
        fetch(file).then(response => response.json()).then(c => {
          setAnimation(c);
        });
        return () => setAnimation(null);
      }
    },
    [file],
  );

  React.useEffect(() => {
    // Recalculate original animation colors
    setColors([]);

    const rows = [];

    const { ratio: jsonRatio } = getDimensions(animation) || {};
    setRatio(jsonRatio);

    if (animation && animation.layers) {
      getColors(animation.layers, color => rows.push(color));
    }

    if (animation && animation.assets) {
      animation.assets.forEach((asset, i) => getColors(asset.layers, color => rows.push(color), i));
    }

    setTimeout(() => setColors(rows), 500);
    return () => setColors([]);
  }, [animation]);

  const pickColor = (newColor, oldColor) => {
    const rgb = hexToRgb(newColor);

    const newColors = colors.map(c => {
      if (c.color === oldColor) {
        return { ...c, color: newColor, ...rgb };
      }

      return c;
    });

    setColors(newColors);
  };

  const preparedAnimation = React.useMemo(
    () => {
      const coloredAnimation = { ...animation };
      if (animation && colors && colors.length) {
        colors.forEach(({ i, j, k, r, g, b, a }) => {
          coloredAnimation.layers[i].shapes[j].it[k].c.k = [
            toUnitVector(r),
            toUnitVector(g),
            toUnitVector(b),
            a,
          ];
        });
      }

      return coloredAnimation;
    },
    [animation, colors],
  );

  const showColors = React.useMemo(() => Array.from(new Set(colors.map(c => c.color))), [colors]);

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
  // setColor: PropTypes.func,
  segments: PropTypes.shape({}),
};

export default LottieEditor;
