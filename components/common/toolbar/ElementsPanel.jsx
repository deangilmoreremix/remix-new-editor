import * as React from 'react';
import { observer } from 'mobx-react';
import { Container, Row } from 'reactstrap';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import useUserStore from '../../hooks/useUserStore';
import useUIStore from '../../hooks/useUIStore';

import { LABEL_FEATURES as labelFeature } from '../../../lib/constants/features';

import AnimatedWindow from '../AnimatedWindow';
import CloseButton from '../CloseButton';

const ElementsPanel = observer(({ items }) => {
  const { isSuperAdmin } = useUserStore();
  const {
    checkboxLeft,
    toggleRightBlock,
    toggleLeftBlock,
    prevStateProduce,
    setPrevStateProduce,
  } = useUIStore();

  if (!checkboxLeft) {
    return null;
  }

  if (prevStateProduce) {
    setPrevStateProduce(false);
    return null;
  }

  const onClick = (action) => {
    toggleRightBlock();
    action();
  };

  return (
    <AnimatedWindow isOpen={checkboxLeft}>
      <Container className="elements-panel-container">
        <Row className="elements-panel-inner-row">
          {items.map(({ label, icon, action, disabled }) => {
            if (label === labelFeature.JSON && !isSuperAdmin) {
              return;
            }

            return (
              <button
                key={label}
                className="elements-panel-button"
                disabled={disabled}
                onClick={() => onClick(action)}
                type="button"
              >
                <SVGInline
                  className="elements-panel-icon"
                  classSuffix="-inline"
                  svg={icon}
                  cleanup={['title']}
                />
                <span className="elements-panel-label">{label}</span>
              </button>
            );
          })}
        </Row>
        <CloseButton onClick={() => toggleLeftBlock(false)} />
      </Container>
    </AnimatedWindow>
  );
});

ElementsPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
    disabled: PropTypes.boolean,
  })).isRequired,
};

export default ElementsPanel;
