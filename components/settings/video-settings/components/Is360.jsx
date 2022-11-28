import React from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../../../lib/PropTypes';
import FormCheckboxField from '../../../form/FormCheckboxField';
import VRIcon from '../../../../public/static/images/media/360-degrees.svg';
import { videoTooltips } from '../../../../lib/constants/tooltips';
import HelpIconComponent from '../../../common/HelpIcon';
import HtmlToolTipComponent from '../../../common/HtmlToolTip';


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
      <HtmlToolTipComponent noDelay noIcon message={videoTooltips.value
      }>
      <SVGInline
        className={classnames('icon-360', { 'icon-360-active': value })}
        classSuffix=""
        svg={VRIcon}
        cleanup={['title']}
        component="div"
      />
      </HtmlToolTipComponent>
    </div>
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
