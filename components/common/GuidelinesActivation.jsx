import React from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import useProjectStore from '../hooks/useProjectStore';

import FieldBuilder from '../form/FieldBuilder';

import guidelinesIcon from '../../public/static/svgImages/guidlines.svg';

const GuidelinesActivation = observer(() => {
  const { isGuideLines, setGuideLines } = useProjectStore();

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
        value={isGuideLines}
        onChange={() => setGuideLines(!isGuideLines)}
        name="guidelines"
        floatClassName="guidelines-field"
      />
    </div>
  );
});

export default GuidelinesActivation;
