import React, { useState, memo } from 'react';
import { ClickOutsideListener } from 'react-click-outside-listener';
import HelpIcon from '@material-ui/icons/Help';
import PropTypes from '../../lib/PropTypes';

const HelpIconComponent = memo((props) => {
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
  } = props;

  const [openCloud, setOpenCloud] = useState(false);

  const handleClickOnIcon = (event) => {
    event.stopPropagation();
    setOpenCloud(!openCloud);
  };

  const messageCloud = (msg) => (
    <div
      className={`
                help-icon__window help-icon__window-${isLeft ? 'right' : 'left'}
                help-icon__window-${isTop ? 'top' : 'normal'}
                help-icon__window-${isBottom && 'bottom'}
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
              style={{
                height: noPadding ? '35px' : `${height}px`,
              }}
            >
              {mouseEntered ? (
                <HelpIcon
                  className={`help-icon__icon help-icon__icon-${whiteIcon ? 'white' : 'red'}`}
                  onMouseEnter={handleClickOnIcon}
                  onMouseLeave={() => setOpenCloud(false)}
                />
              ) : (
                <HelpIcon
                  className={`help-icon__icon help-icon__icon-${whiteIcon ? 'white' : 'red'}`}
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
};

export default HelpIconComponent;
