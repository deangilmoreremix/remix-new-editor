import React, { memo } from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import classnames from 'classnames';
import { createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import helpIcon from '../../public/static/svgImages/common/help-icon.svg';

const blackCloud = createMuiTheme({
  overrides: {
    MuiTooltip: {
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '.5em',
        fontSize: '12px',
        fontFamily: 'Proxima Nova',
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
      },
      arrow: {
        color: 'rgba(0, 0, 0, 0.8)',
      },
    },
  },
});

const TooltipProvider = memo((props) => {
  const { children } = props;

  return (
    <MuiThemeProvider theme={blackCloud}>
      <Tooltip
        {...props}
        enterDelay={1000}
        leaveDelay={100}
        arrow
      >
        {children}
      </Tooltip>
    </MuiThemeProvider>
  );
});

const HelpIconComponent = memo((props) => {
  const {
    message,
    children,
    noIcon,
    placement,
    height,
    noPadding,
    padding,
    isInput,
    whiteIcon,
    projectCourses,
  } = props;

  return (
    <>
      {!noIcon ? (
        <div
          className={classnames('help-icon', { 'help-icon-project': projectCourses })}
          style={{ padding: noPadding ? 0 : undefined }}
        >
          <div
            className={isInput && 'help-icon__input'}
            style={{
              height: noPadding ? '35px' : `${height}px`,
              padding,
            }}
          >
            <TooltipProvider
              placement={placement}
              title={message}
            >
              <SVGInline
                className={classnames('help-icon__icon', { 'help-icon__icon-white': whiteIcon })}
                svg={helpIcon}
              />
            </TooltipProvider>
          </div>
        </div>
      ) : (
        <TooltipProvider
          placement={placement}
          title={message}
        >
          {children}
        </TooltipProvider>
      )}
    </>
  );
});

TooltipProvider.propTypes = {
  children: PropTypes.element.isRequired,
};

HelpIconComponent.propTypes = {
  message: PropTypes.string.isRequired,
  noPadding: PropTypes.bool,
  height: PropTypes.number,
  noIcon: PropTypes.bool,
  padding: PropTypes.string,
  isInput: PropTypes.bool,
  children: PropTypes.element,
  placement: PropTypes.string,
  whiteIcon: PropTypes.boolean,
  projectCourses: PropTypes.boolean,
};

HelpIconComponent.defaultProps = {
  placement: 'bottom',
};

export default HelpIconComponent;
