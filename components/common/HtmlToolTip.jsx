import React, { memo } from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import { withStyles, makeStyles } from '@material-ui/core/styles';
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
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
      },
      arrow: {
        color: 'rgba(0, 0, 0, 0.8)',
      },
    },
  },
});

const HtmlTooltip = withStyles((theme) => ({
    tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '.5em',
        fontSize: '12px',
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
      },
}))(Tooltip);

const TooltipProvider = (props) => {
  const { children, placement, title, isDelay } = props;
  return (
    <MuiThemeProvider theme={blackCloud}>
      {/* <Tooltip
        placement={placement}
        title={title}
        enterDelay={!isDelay ? 1000 : 0}
        arrow
      >
        {children}
      </Tooltip> */}
        <HtmlTooltip
          title={
            <React.Fragment>
              <em>{"For 360 videos, we recommend using only videos downloaded from your computer.  You can use"}</em> <a href='http://download.vidcloud.io/' target='blank'>our downloader</a>{' '}
            </React.Fragment>
          }
          interactive={true}
        >
          {children}
        </HtmlTooltip>
      
    </MuiThemeProvider>
  );
};

const HtmlToolTipComponent = memo((props) => {
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
    noDelay,
  } = props;

  return (
    <>
      {!noIcon ? (
        <div
          className={classnames('help-icon', {
            'help-icon-project': projectCourses,
            'help-icon__input': isInput,
          })}
          style={{ padding: noPadding ? 0 : undefined }}
        >
          <div
            style={{
              height: noPadding ? '35px' : `${height}px`,
              padding,
            }}
          >
            <TooltipProvider
              isDelay={noDelay}
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
          isDelay={noDelay}
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
  isDelay: PropTypes.bool,
  placement: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

HtmlToolTipComponent.propTypes = {
  message: PropTypes.string.isRequired,
  noPadding: PropTypes.bool,
  height: PropTypes.number,
  noIcon: PropTypes.bool,
  padding: PropTypes.string,
  isInput: PropTypes.bool,
  children: PropTypes.element,
  placement: PropTypes.string,
  whiteIcon: PropTypes.bool,
  projectCourses: PropTypes.bool,
  noDelay: PropTypes.bool,
};

HtmlToolTipComponent.defaultProps = {
  placement: 'bottom',
};

export default HtmlToolTipComponent;
