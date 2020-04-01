// TOOD: This is a boilerplate for JSON-based animations player
import * as React from 'react';
import Lottie from '../../lib/lottie/Lottie';

import PropTypes from '../../lib/PropTypes';

const LottiePlayer = ({ showControls, file, width, height }) => {
  const [isStopped, setIsStopped] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [animation, setAnimation] = React.useState(null);

  const options = {
    loop: false,
    autoplay: true,
    animationData: animation,
    path: '/public/menu.json',
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  React.useEffect(
    () => {
      if (file) {
        fetch(file).then(response => response.json()).then(c => {
          console.log(c);
          setAnimation(c);
        });

        return () => setAnimation(null);
        // getJSONP(`${file}&callback=?`, (data) => {
        // getJSONP(`${file}`, (data) => {
        //   console.log(data);
        // });
      }
    },
    [file],
  );

  return (
    <React.Fragment>
      { animation && (
        <Lottie
          options={options}
          height={height || 100}
          width={width || 100}
          isStopped={isStopped}
          isPaused={isPaused}
          // segments={[17, 56]}
          // eventListeners={[{ eventName: 'complete', callback: update }]}
          speed={1}
          looped
          // style={{ position: 'absolute', top: 0, left: 0 }}
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

LottiePlayer.propTypes = {
  showControls: PropTypes.bool,
  file: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
};

export default LottiePlayer;
