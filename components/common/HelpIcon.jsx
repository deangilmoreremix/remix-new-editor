import React, { useState, memo } from 'react';
import { ClickOutsideListener } from 'react-click-outside-listener';
import HelpIcon from '@material-ui/icons/Help';
import PropTypes from '../../lib/PropTypes';

const HelpIconComponent = memo((props) => {
  let tooltipTime;

  const {
    message,
    noPadding,
    height,
    isTop,
    isLeft,
    mouseEntered,
    whiteIcon,
    noIcon,
    onParentMouseEntered,
    isBottom,
    isTimeline,
    isText,
    padding,
    isInput,
    isProduce,
    isLibrary,
  } = props;

  const [openCloud, setOpenCloud] = useState(false);

  const handleClickOnIcon = (event) => {
    event.stopPropagation();
    setOpenCloud(!openCloud);
  };

  const handleTooltipMouseEnter = (event) => {
    event.stopPropagation();
    tooltipTime = setTimeout(
      () => setOpenCloud(true), 1000,
    );
  };

  const handleTooltipMouseLeave = () => {
    clearTimeout(tooltipTime);
    setOpenCloud(false);
  };

  const messageCloud = (msg) => (
    <div
      className={`
        ${!isLibrary && `help-icon__window help-icon__window-${isLeft ? 'right' : 'left'}`}
        help-icon__window help-icon__window-${isTimeline && 'timeline'}
        help-icon__window-${isTop ? 'top' : 'normal'}
        ${isLibrary && 'help-icon__window-library'}
        ${isBottom && 'help-icon__window-bottom'}
        ${isText && 'help-icon__window-text'}
        ${isProduce && 'help-icon__window-produce'}
      `}
    >
      {msg}
    </div>
  );

  return (
    <>
      {!noIcon ? (
        <div className="help-icon" style={{ padding: noPadding ? 0 : undefined }}>
          <ClickOutsideListener onClickOutside={() => setOpenCloud(false)}>
            <div
              className={isInput && 'help-icon__input'}
              style={{
                height: noPadding ? '35px' : `${height}px`,
                padding,
              }}
            >
              {mouseEntered ? (
                <HelpIcon
                  className={`help-icon__icon help-icon__icon-${whiteIcon ? 'white' : 'gray'}`}
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                />
              ) : (
                <HelpIcon
                  className={`help-icon__icon help-icon__icon-${whiteIcon ? 'white' : 'gray'}`}
                  onClick={handleClickOnIcon}
                />
              )}
              {openCloud && messageCloud(message)}
            </div>
          </ClickOutsideListener>
        </div>
      ) : (
        <>
          {onParentMouseEntered && messageCloud(message)}
        </>
      )}
    </>
  );
});

HelpIconComponent.propTypes = {
  message: PropTypes.string.isRequired,
  noPadding: PropTypes.bool,
  height: PropTypes.number,
  isTop: PropTypes.bool,
  isLeft: PropTypes.bool,
  mouseEntered: PropTypes.bool,
  whiteIcon: PropTypes.bool,
  noIcon: PropTypes.bool,
  onParentMouseEntered: PropTypes.bool,
  isBottom: PropTypes.bool,
  isTimeline: PropTypes.bool,
  isText: PropTypes.bool,
  padding: PropTypes.string,
  isInput: PropTypes.bool,
  isProduce: PropTypes.bool,
  isLibrary: PropTypes.bool,
};

export default HelpIconComponent;
