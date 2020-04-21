import React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import useUIStore from '../hooks/useUIStore';

import FieldBuilder from '../form/FieldBuilder';

import guidelinesIcon from '../../public/static/svgImages/guidlines.svg';

const GuidelinesActivation = observer(() => {
  const { hasGuidLines, setGuideLines } = useUIStore();

  return (
    <div className="guidelines-activation">
      <SVGInline
        svg={guidelinesIcon}
        cleanup={['guidelines']}
        className="guidelines-icon"
      />
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

export default GuidelinesActivation;
