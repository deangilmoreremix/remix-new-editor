import React from 'react';
import { observer } from 'mobx-react';
import { Row } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';

import useUIStore from '../../hooks/useUIStore';

import Element from './Element';
import AnimatedWindow from '../AnimatedWindow';
import CloseButton from '../CloseButton';

const ElementsPanel = observer(({ items }) => {
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
      <div className="elements-panel-container">
        <Row className="elements-panel-inner-row">
          {items.map((item) => {
            if (item.disabled) {
              return;
            }

            return (
              <Element
                key={`element-${item.label}`}
                item={item}
                onClick={onClick}
              />
            );
          })}
        </Row>
        <CloseButton onClick={() => toggleLeftBlock(false)} />
      </div>
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
