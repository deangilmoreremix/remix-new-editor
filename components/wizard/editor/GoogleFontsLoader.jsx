import React from 'react';
import FontLoader from 'react-google-font-loader';

import PropTypes from '../../../lib/PropTypes';

const GoogleFontsLoader = ({ fonts }) => (
  <FontLoader
    fonts={fonts.map(item => ({ font: item }))}
  />
);

GoogleFontsLoader.propTypes = {
  fonts: PropTypes.arrayOrObservableArrayOf(PropTypes.string).isRequired,
};

export default GoogleFontsLoader;
