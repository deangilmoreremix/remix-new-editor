import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import { Row } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';

import useUIStore from '../../hooks/useUIStore';

import Element from './Element';
import AnimatedWindow from '../AnimatedWindow';
import CloseButton from '../CloseButton';
import { SECTIONS } from '../../../lib/constants/settings';

const ElementsPanel = observer(({ items }) => {
  const {
    checkboxLeft,
    toggleRightBlock,
    toggleLeftBlock,
    prevStateProduce,
    setPrevStateProduce,
  } = useUIStore();

  const creativeElements = useMemo(
    () => items.filter(({ uiSection, disabled }) => uiSection === SECTIONS.basic && !disabled),
    [items]);
  const leadGenElements = useMemo(
    () => items.filter(({ uiSection, disabled }) => uiSection === SECTIONS.leadGeneration
      && !disabled), [items]);
  const advancedElements = useMemo(
    () => items.filter(({ uiSection, disabled }) => uiSection === SECTIONS.advanced && !disabled),
    [items]);

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

  const elementsRenderer = (elements) => elements.map((
    item,
  ) => (
    <Element
      key={`element-${item.label}`}
      item={item}
      onClick={onClick}
    />
  ));

  return (
    <AnimatedWindow isOpen={checkboxLeft}>
      <div className="elements-panel-container">
        <Row className="elements-panel-inner-row">
          {creativeElements.length ? (<h3 className="elements-panel-section__title">Creative & Personalization</h3>) : null}
          {creativeElements.length ? elementsRenderer(creativeElements) : null}
          {leadGenElements.length ? (<h3 className="elements-panel-section__title">Lead Generation</h3>) : null}
          {leadGenElements.length ? elementsRenderer(leadGenElements) : null}
          {advancedElements.length ? (<h3 className="elements-panel-section__title">Advanced Tools / Add-ons</h3>) : null}
          {advancedElements.length ? elementsRenderer(advancedElements) : null}

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
