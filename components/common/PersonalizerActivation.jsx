import React, { useMemo } from 'react';
import SVGInline from 'react-svg-inline';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';

import FieldBuilder from '../form/FieldBuilder';

import personalizerIcon from '../../public/static/svgImages/personalizer.svg';
import { SHOW_LB } from '../../lib/constants/text-info';
import useProjectStore from '../hooks/useProjectStore';

const PersonalizerActivation = observer(({ marginLeft, togglePersonalizer }) => {
  const { retarget, showedRetarget } = useProjectStore();
  const personalizerLabel = useMemo(() => {
    if (SHOW_LB[retarget.kind]) {
      return SHOW_LB[retarget.kind];
    }
    return '';
  }, [retarget.kind]);


  return retarget.kind ? (
    <div
      className="personalizer-activation"
      style={marginLeft && { marginLeft }}
    >
      <SVGInline
        svg={personalizerIcon}
        cleanup={['personalizer']}
        className="personalizer-icon"
      />
      <FieldBuilder
        type="checkbox"
        label={personalizerLabel}
        value={showedRetarget}
        onChange={() => togglePersonalizer(!showedRetarget)}
        name="personalizer"
        floatClassName="personalizer-field"
      />
    </div>
  ) : null;
});

PersonalizerActivation.propTypes = {
  marginLeft: PropTypes.string,
};

export default PersonalizerActivation;
