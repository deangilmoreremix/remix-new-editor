import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react';
import { Row } from 'reactstrap';

import PropTypes from '../../../lib/PropTypes';

import useUIStore from '../../hooks/useUIStore';

import Element from './Element';
import AnimatedWindow from '../AnimatedWindow';
import CloseButton from '../CloseButton';
import { SECTIONS } from '../../../lib/constants/settings';
import { useRouter } from 'next/router';

const ElementsPanel = observer(({ items }) => {
  const {
    checkboxLeft,
    toggleRightBlock,
    toggleLeftBlock,
    prevStateProduce,
    setPrevStateProduce,
  } = useUIStore();
  const {
    pathname,
    query: { isRecorder, isTextToSpeech, isListBuilder, isLeadGenerator, isGoogleMap, isAiArtGenerator, isBgDiffusion },
    push,
  } = useRouter();



  useEffect(() => {
    const recorder = (isRecorder === "true");
    const textToSpeech = (isTextToSpeech === "true");
    const listBuilder = (isListBuilder === "true");
    const leadGenerator = (isLeadGenerator === "true");
    const googleMap = (isGoogleMap === "true");
    const aiArtGenerator = (isAiArtGenerator === 'true');
    const bgDiffusion = (isBgDiffusion === 'true');

    if (recorder) {
      const recorderData = items.find((ele) => ele.label == "ScreenRec");
      recorderData.action();
    }
    if (textToSpeech) {
      const textToSpeechData = items.find((ele) => ele.label == "Smart Speech");
      const { action } = textToSpeechData;
      toggleRightBlock();
      action();
    }
    if (listBuilder) {
      const listBuilderData = items.find((ele) => ele.label == "List Builder");
      const { action } = listBuilderData;
      action();
    }
    if (leadGenerator) {
      const leadGeneratorData = items.find((ele) => ele.label == "Lead Generator");
      const { action } = leadGeneratorData;
      action();
    }
    if (googleMap) {
      const googleMapData = items.find((ele) => ele.label == "Google Map");
      const { action } = googleMapData;
      action();
    }
    if (aiArtGenerator) {
      const aiArtGeneratorData = items.find((ele) => ele.label == "AI Art Generator");
      const { action } = aiArtGeneratorData;
      toggleRightBlock();
      action();
    }
    if (bgDiffusion) {
      const bgDiffusionData = items.find((ele) => ele.label == "BG Diffusion");
      const { action } = bgDiffusionData;
      toggleRightBlock();
      action();
    }
  }, [])

  const personalizationElements = useMemo(
    () => items.filter(({ uiSection, adminElement }) => uiSection === SECTIONS.basic && adminElement),
    [items]);
  const leadGenElements = useMemo(
    () => items.filter(({ uiSection }) => uiSection === SECTIONS.leadGeneration
    ), [items]);
  const advancedElements = useMemo(
    () => items.filter(({ uiSection, }) => uiSection === SECTIONS.advanced),
    [items]);

  // creative elements
  const creativeElements = useMemo(
    () => items.filter(({ uiSection, }) => uiSection === SECTIONS.creative),
    [items]);

  // video control
  const videoControlElements = useMemo(
    () => items.filter(({ uiSection }) => uiSection === SECTIONS.videoControl),
    [items]);

  if (!checkboxLeft) {
    return null;
  }

  if (prevStateProduce) {
    setPrevStateProduce(false);
    return null;
  }

  const onClick = (action) => {
    console.log("action>>>",action)
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
          {personalizationElements.length ? (<h3 className="elements-panel-section__title"> Personalization</h3>) : null}
          {personalizationElements.length ? elementsRenderer(personalizationElements) : null}

          {creativeElements.length ? (<h3 className="elements-panel-section__title">Creative</h3>) : null}
          {creativeElements.length ? elementsRenderer(creativeElements) : null}

          {videoControlElements.length ? (<h3 className="elements-panel-section__title">Video Controls</h3>) : null}
          {videoControlElements.length ? elementsRenderer(videoControlElements) : null}

          {leadGenElements.length ? (<h3 className="elements-panel-section__title">Lead Generation</h3>) : null}
          {leadGenElements.length ? elementsRenderer(leadGenElements) : null}

          {advancedElements.length ? (<h3 className="elements-panel-section__title">Advanced Tools / Add-ons</h3>) : null}
          {advancedElements.length ? elementsRenderer(advancedElements) : null}

        </Row>
        <CloseButton className="close-button-extend" onClick={() => toggleLeftBlock(false)} />
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
    adminElement: PropTypes.boolean,
  })).isRequired,
};

export default ElementsPanel;
