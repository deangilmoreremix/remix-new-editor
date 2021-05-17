import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { observer } from 'mobx-react';

import Media from './Media';
import Overlays from './Overlays';
import { LibrarySpinner } from '../../media/Loader';
import HorizontalStepper from '../../form/HorizontalStepper';
import NicheScriptsModalContent from './NicheScriptsModalContent';
import useMultiselectTemplateStore from '../../hooks/useMultiselectTemplateStore';
import { showError } from '../../../lib/services/alertService';
import useProjectStore from '../../hooks/useProjectStore';
import Preview from './Preview';
import { STEPS } from '../../../lib/constants/templateGenerator';

const VIDEO = 'video';

const ModalContent = observer(({ setHeaderProps, handleClose }) => {
  const [activeTab, setTab] = useState(STEPS.MEDIA);
  const [isLoading, setLoading] = useState(false);
  const templateStore = useMultiselectTemplateStore();
  const { showWarning } = useProjectStore();
  const {
    toggleElement,
    selectedNiche,
    selectedOverlay,
    addElements,
    selectedVideo,
    clearData,
  } = templateStore;

  const setActiveTab = useCallback((tab) => {
    let message;
    switch (tab) {
      case STEPS.SCRIPT:
        if (!selectedVideo.size) {
          message = 'Please select at least one video';
        }
        break;
      case STEPS.OVERLAY:
        if (selectedVideo.size < 2) {
          message = 'To use overlays, you need to select two or more videos';
        } else if (!selectedNiche) {
          message = 'Please select a niche script';
        }
        break;
      case STEPS.PREVIEW:
        if (!selectedVideo.size) {
          message = 'Please select at least one video';
        } else if (!selectedNiche) {
          message = 'Please select a niche script';
        }
        break;
      default: {
        break;
      }
    }
    if (message) {
      showWarning(message);
    } else {
      setTab(tab);
    }
  }, [selectedVideo.size, selectedNiche]);

  const onSelect = React.useCallback((entity, item) => {
    switch (entity) {
      case VIDEO:
        if (selectedVideo.size < 5 || selectedVideo.has(item._id)) {
          toggleElement(entity, item);
        } else {
          showWarning('Select only 5 videos at a maximum. '
            + 'If you want to add more, you can do so later in the timeline.');
        }
        break;
      default:
        toggleElement(entity, item);
    }
  }, []);

  const steps = useMemo(() => [
    { label: 'Video', content: <Media onSelect={onSelect} /> },
    { label: 'Script', content: <NicheScriptsModalContent onSelect={onSelect} activeElement={selectedNiche} /> },
    { label: 'Overlay', content: <Overlays onSelect={onSelect} activeElement={selectedOverlay} /> },
    { label: 'Preview', content: <Preview setActiveTab={setActiveTab} /> },
  ], [selectedNiche, selectedOverlay]);

  const Content = useMemo(() => steps[activeTab].content, [activeTab]);

  useEffect(() => {
    setHeaderProps({ setTab: setActiveTab });
  }, [setActiveTab]);

  useEffect(() => {
    setHeaderProps({ activeTab });
  }, [activeTab]);

  const allowedAdd = useMemo(() => activeTab > STEPS.OVERLAY, [activeTab]);

  const nextButton = useMemo(() => (allowedAdd ? 'Add to Timeline' : 'Next'), [allowedAdd]);

  const onNext = useCallback(async () => {
    if (allowedAdd) {
      let hasError = false;
      try {
        setLoading(true);
        await addElements();
      } catch (e) {
        hasError = true;
        showError(e.message);
      } finally {
        setLoading(false);
        clearData();
        if (!hasError) {
          handleClose();
        } else {
          setTab(STEPS.MEDIA);
        }
      }
    } else {
      let step = 1;
      if (activeTab === 1 && selectedVideo.size < 2) {
        step = 2;
      }
      setTab(activeTab + step);
    }
  }, [allowedAdd, activeTab]);

  const disabledButton = useMemo(() => {
    if (isLoading) {
      return true;
    }
    switch (activeTab) {
      case STEPS.MEDIA:
        return !selectedVideo.size;
      case STEPS.SCRIPT:
        return !selectedNiche;
      default: {
        return !selectedVideo.size || !selectedNiche;
      }
    }
  }, [activeTab, selectedVideo.size, selectedNiche]);

  const isPreview = useMemo(() => activeTab === STEPS.PREVIEW, [activeTab]);

  return (
    <>
      <div className="generator-body">
        <div className="extra-container">
          <button
            className={classnames('btn-add', 'next-button', { disabled: disabledButton })}
            disabled={disabledButton}
            onClick={onNext}
          >
            {nextButton}
          </button>
          <HorizontalStepper
            steps={[{ label: 'Video', passed: isPreview && !!selectedVideo.size },
              { label: 'Script', passed: isPreview && !!selectedNiche },
              { label: 'Overlay', passed: isPreview && !!selectedOverlay },
            ]}
            activeStep={isPreview && !selectedOverlay ? STEPS.OVERLAY : activeTab}
          />
        </div>
        {isLoading ? <LibrarySpinner /> : Content}
        <div className="gradient" />
      </div>
    </>
  );
});

ModalContent.propTypes = {
  setHeaderProps: PropTypes.func.isRequired,
};

export default ModalContent;
