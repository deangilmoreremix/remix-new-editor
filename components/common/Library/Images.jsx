import React from 'react';
import { v4 as uuidv4 } from 'uuid';

import PropTypes from '../../../lib/PropTypes';

const Images = ({ images }) => (
  <div className="library-layout__images">
    {
          images.map(src => (
            <div key={uuidv4()} className="library-layout__image">
              <img src={src} alt="img" />
            </div>
          ))
    }
  </div>
);

Images.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string),
};

export default Images;
