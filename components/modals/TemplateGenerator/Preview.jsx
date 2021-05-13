import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import IframePlayer from '../../media/VideoGallery/IframePlayer';
import useMultiselectTemplateStore from '../../hooks/useMultiselectTemplateStore';
import VideoTemplate from '../../common/projectDataList/VideoTemplate';
import PopcornPreview from '../../common/libraryElements/PopcornPreview';
import NicheScript from './NicheScript';
import { entities, STEPS } from '../../../lib/constants/templateGenerator';
import useProjectStore from '../../hooks/useProjectStore';

import minusIcon from '../../../public/static/svgImages/minus.svg';
import ProjectLoader from '../../common/ProjectLoader';
import { showError } from '../../../lib/services/alertService';


const Preview = observer(({ setActiveTab }) => {
  const templateStore = useMultiselectTemplateStore();
  const { showWarning } = useProjectStore();

  const {
    selectedVideo,
    selectedOverlay,
    selectedNiche,
    toggleElement,
    getPreviewData,
    item: previewData,
  } = templateStore;

  const [isLoading, setIsLoading] = useState(!previewData);

  useEffect(() => {
    if (!previewData) {
      const fetchData = async () => {
        await getItem();
      };
      fetchData();
    }
  }, [previewData]);

  useEffect(() => {
    setIsLoading(!previewData);
  }, [previewData]);

  const removeVideo = useCallback((item) => {
    if (selectedVideo.size <= 2) {
      showWarning('To use overlays, you need to select two or more videos');
    }
    setIsLoading(true);
    toggleElement(entities.VIDEO, item);
  }, [selectedVideo.size]);

  const removeOverlay = useCallback(() => (e) => {
    e.stopPropagation();
    setIsLoading(true);
    toggleElement(entities.OVERLAY);
  }, []);

  const hasOneVideo = useMemo(() => selectedVideo.size < 2, [selectedVideo.size]);

  const videoActions = useMemo(() => (hasOneVideo ? null : [{
    icon: minusIcon,
    onClick: removeVideo,
    className: 'preview__delete',
    name: 'video-delete',
  },
  ]), [hasOneVideo]);

  const overlayActions = useMemo(() => (hasOneVideo ? null : [{
    icon: minusIcon,
    onClick: removeOverlay,
    className: 'preview__delete',
    name: 'overlay-delete',
  },
  ]), [hasOneVideo]);

  const videoElements = useMemo(() => {
    if (!selectedVideo.size) {
      return null;
    }
    const result = [];
    selectedVideo.forEach(item => {
      result.push(<VideoTemplate
        className="video__item video-element"
        item={item}
        actions={videoActions}
        key={item._id}
      />);
    });
    return result;
  }, [selectedVideo.size]);

  const overlayElement = useMemo(() => {
    if (!selectedOverlay) {
      return (
        <div
          className={classnames('overlays__item-container', 'overlays__item',
            'select', { disabled: hasOneVideo })}
          onClick={() => setActiveTab(STEPS.OVERLAY)}
          onKeyPress={() => {}}
          role="button"
          tabIndex="-1"
        >
          <div className="select-overlay-container">
            <span>
              {hasOneVideo ? 'Please select more than one video and Select overlay'
                : 'Please select overlay'}
            </span>
          </div>
        </div>
      );
    }
    return (
      <PopcornPreview
        className={classnames({ disabled: hasOneVideo }, 'overlays__item')}
        onClick={() => setActiveTab(STEPS.OVERLAY)}
        actions={overlayActions}
        item={selectedOverlay}
      />
    );
  }, [hasOneVideo, selectedOverlay]);

  const scriptElement = useMemo(() => {
    if (!selectedNiche) {
      return null;
    }
    return (
      <NicheScript
        onClick={() => { setActiveTab(STEPS.SCRIPT); }}
        item={selectedNiche}
      />
    );
  }, [selectedNiche]);

  const getItem = async () => {
    try {
      await getPreviewData();
    } catch (e) {
      showError(e.message);
    }
  };


  return (
    <>
      <div className="search">
        <h4 className="search-title">Preview</h4>
        <span
          className="library__search-box search-box preview-box"
        >
          Complete your selection and add the files to the timeline
        </span>
      </div>
      <div className="generator-list preview-tab__content">
        <div className="preview-tab-settings">
          <div className="preview-tab__content-overlays video-list">
            <div className="elements-list list-items">
              {videoElements}
              {overlayElement}
            </div>
          </div>
          <div className="preview-tab__content-scripts">
            {scriptElement}
          </div>
        </div>
        <div className="preview-tab__content-watch">
          { isLoading ? <div className="iframe-container"><ProjectLoader /></div>
            : <IframePlayer item={previewData} /> }
        </div>
      </div>
    </>
  );
});

export default Preview;
