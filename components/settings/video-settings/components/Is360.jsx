import React from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../../../lib/PropTypes';
import FormCheckboxField from '../../../form/FormCheckboxField';
import VRIcon from '../../../../public/static/images/media/360-degrees.svg';


const Is360 = React.memo(({
  value,
  onChange,
  className,
  showHint,
  downloaderEnabled,
}) => (
  <div className="is-360-wrapper">
    <div className="is-360-checkbox">
      <FormCheckboxField
        onChange={onChange}
        value={value}
        floatClassName={className}
      />
      <SVGInline
        className={classnames('icon-360', { 'icon-360-active': value })}
        classSuffix=""
        svg={VRIcon}
        cleanup={['title']}
        component="div"
      />
    </div>
    {showHint
      && (
        <div className="hint-360">
          {'For 360 videos, we recommend using only videos \n downloaded from your computer. \n'}
          &nbsp;
          {downloaderEnabled && 'You can use '}
          {downloaderEnabled && (
            <a
              href="http://download.vidcloud.io/"
              className="library__block--title"
              target="_blank"
              rel="noopener noreferrer"
            >
          our downloader
            </a>
          ) }
        </div>
      )}
  </div>
));

Is360.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.bool,
  showHint: PropTypes.bool,
  className: PropTypes.string,
  downloaderEnabled: PropTypes.bool,
};

export default Is360;
