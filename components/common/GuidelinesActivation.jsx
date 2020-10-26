import React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import useUIStore from '../hooks/useUIStore';

import FieldBuilder from '../form/FieldBuilder';

import guidelinesIcon from '../../public/static/svgImages/guidlines.svg';
import { mainTooltips } from '../../lib/constants/tooltips';
import HelpIconComponent from './HelpIcon';

const GuidelinesActivation = observer(({ marginLeft }) => {
  const { hasGuidLines, setGuideLines } = useUIStore();

  return (
    <div
      className="guidelines-activation"
      style={marginLeft && { marginLeft }}
    >
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
  );
});

GuidelinesActivation.propTypes = {
  marginLeft: PropTypes.string,
};

export default GuidelinesActivation;
