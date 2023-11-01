import React, { useEffect, useState } from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import useUIStore from '../hooks/useUIStore';

import FieldBuilder from '../form/FieldBuilder';

import guidelinesIcon from '../../public/static/svgImages/guidlines.svg';
import { mainTooltips } from '../../lib/constants/tooltips';
import HelpIconComponent from './HelpIcon';
import PercentageProgressBar from '../media/PercentageProgressBar';
import useProjectStore from '../hooks/useProjectStore';

const GuidelinesActivation = observer(({ marginLeft }) => {
  const { hasGuidLines, setGuideLines } = useUIStore();
  const { isLoadingIosProcess } = useProjectStore();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(interval); // Stop the progress bar when it reaches 100%
          return 100;
        }
        return prevProgress + 1;
      });
    }, 1200); // Increment progress every 1200ms (2 minutes)

    return () => {
      clearInterval(interval); // Clean up the interval on component unmount
    };
  }, [progress]);

  return (
    <div
      className="guidelines-activation"
      style={marginLeft && { marginLeft }}
    >
      <div className='guideline-component'>
        <HelpIconComponent
          noIcon
          message={mainTooltips.guideline}
        >
          <SVGInline
            svg={guidelinesIcon}
            className="guidelines-icon"
            cleanup={['guidelines']}
          />
        </HelpIconComponent>
        <FieldBuilder
          type="checkbox"
          label="Guideline"
          value={hasGuidLines}
          onChange={() => setGuideLines(!hasGuidLines)}
          name="guidelines"
          floatClassName="guidelines-field"
        />
      </div>
      {isLoadingIosProcess && <div className="container-menu__actions__item">
        <PercentageProgressBar width={250} progress={progress} />
      </div>}
    </div>
  );
});

GuidelinesActivation.propTypes = {
  marginLeft: PropTypes.string,
};

export default GuidelinesActivation;
