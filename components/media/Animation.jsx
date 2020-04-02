import React from 'react';

import PropTypes from '../../lib/PropTypes';
import {animations} from "../../lib/constants/animations";

const Animation = ({ type }) => (
  <div className="animation-container">
    <p className="animation-container__title">Add Animation</p>
    <div className="animation-blocks">
      {
        animations[type].types.map(item => (
          <div className="animation-block">{item}</div>
        ))
      }
    </div>
  </div>
);

Animation.propTypes = {
  type: PropTypes.string.isRequired,
};

export default Animation;
