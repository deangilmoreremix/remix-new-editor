import React from 'react';
import PropTypes from 'prop-types';
import SVGInline from 'react-svg-inline';

import generatorImg from '../../../public/static/images/generator.svg';

export default function InitialModalContent({ accept, decline }) {
  return (
    <>
      <p className="template-generator-offer__text">Do you want to use the template Generator?</p>
      <SVGInline
        className="generator-img"
        svg={generatorImg}
        cleanup={['title']}
      />
      <div className="generator-offer__btns">
        <button
          className="generator-offer__btn generator-offer__yes"
          onClick={accept}
        >
          Yes
        </button>
        <button
          className="generator-offer__btn generator-offer__no"
          onClick={decline}
        >
          No, thanks
        </button>
      </div>
    </>
  );
}

InitialModalContent.propTypes = {
  accept: PropTypes.func.isRequired,
  decline: PropTypes.func.isRequired,
};
