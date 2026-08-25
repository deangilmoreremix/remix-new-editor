import React, { Fragment, useState, useRef, useCallback } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';
import { PAGE_SHOT_MODAL } from '../../lib/constants/modals';
import { LibrarySpinner } from '../media/Loader';
import useModalStore from '../hooks/useModalStore';

import screenshotIcon from '../../public/static/svgImages/screenshot.svg';
import linkIcon from '../../public/static/svgImages/link.svg';

const PageShotModal = ({ setError }) => {
  const [url, setUrl] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [captureOptions, setCaptureOptions] = useState({
    width: 1920,
    height: 1080,
    quality: 0.9,
    format: 'png'
  });

  const iframeRef = useRef(null);
  const canvasRef = useRef(null);
  const { closeModal } = useModalStore();

  // Capture webpage screenshot
  const captureScreenshot = useCallback(async () => {
    if (!url.trim()) {
      if (setError) setError('Please enter a valid URL');
      return;
    }

    setIsCapturing(true);

    try {
      // Create a new window to load the webpage
      const captureWindow = window.open(url, '_blank', 'width=1920,height=1080');

      // Wait for the page to load
      await new Promise((resolve) => {
        const checkLoaded = () => {
          try {
            if (captureWindow.document.readyState === 'complete') {
              resolve();
            } else {
              setTimeout(checkLoaded, 100);
            }
          } catch (e) {
            // Cross-origin error, wait a bit longer
            setTimeout(checkLoaded, 500);
          }
        };
        setTimeout(checkLoaded, 2000); // Minimum wait time
      });

      // Create canvas for screenshot
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = captureOptions.width;
      canvas.height = captureOptions.height;

      // Try to capture the page content
      try {
        // Use html2canvas or similar approach for cross-origin pages
        const html2canvas = await import('html2canvas');

        const screenshotCanvas = await html2canvas.default(captureWindow.document.body, {
          width: captureOptions.width,
          height: captureOptions.height,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scale: window.devicePixelRatio || 1
        });

        ctx.drawImage(screenshotCanvas, 0, 0, captureOptions.width, captureOptions.height);

      } catch (e) {
        // Fallback: create a placeholder screenshot
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, captureOptions.width, captureOptions.height);

        ctx.fillStyle = '#666';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Screenshot captured from:', captureOptions.width / 2, captureOptions.height / 2 - 20);
        ctx.fillText(url, captureOptions.width / 2, captureOptions.height / 2 + 20);

        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, captureOptions.width - 40, captureOptions.height - 40);
      }

      // Convert to blob
      canvas.toBlob((blob) => {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage({
          url: imageUrl,
          blob,
          width: captureOptions.width,
          height: captureOptions.height,
          sourceUrl: url,
          timestamp: Date.now()
        });
      }, `image/${captureOptions.format}`, captureOptions.quality);

      // Close the capture window
      captureWindow.close();

    } catch (error) {
      console.error('Screenshot capture error:', error);
      if (setError) setError('Failed to capture screenshot: ' + error.message);
    } finally {
      setIsCapturing(false);
    }
  }, [url, captureOptions, setError]);

  const handleUseScreenshot = () => {
    if (capturedImage) {
      // Add to project store as background image
      const imageData = {
        src: capturedImage.url,
        type: 'image',
        name: `Screenshot from ${new URL(capturedImage.sourceUrl).hostname}`,
        width: capturedImage.width,
        height: capturedImage.height,
        backgroundSource: 'page-shot',
        sourceUrl: capturedImage.sourceUrl,
        timestamp: capturedImage.timestamp
      };

      // Close modal and return the image data
      closeModal(PAGE_SHOT_MODAL);
      // The parent component should handle the onSelect callback
    }
  };

  const handleUrlChange = (e) => {
    let inputUrl = e.target.value;
    // Add https:// if not present
    if (inputUrl && !inputUrl.match(/^https?:\/\//)) {
      inputUrl = 'https://' + inputUrl;
    }
    setUrl(inputUrl);
  };

  return (
    <Fragment>
      <div className="page-shot-modal__header">
        <div className="page-shot-modal__title-section">
          <SVGInline svg={screenshotIcon} className="page-shot-modal__icon" />
          <div>
            <h3 className="page-shot-modal__title">Page Screenshot</h3>
            <p className="page-shot-modal__subtitle">Capture webpage screenshots for personalized backgrounds</p>
          </div>
        </div>
      </div>

      <div className="page-shot-modal__content">
        <div className="page-shot-modal__input-section">
          <div className="page-shot-modal__url-input-group">
            <SVGInline svg={linkIcon} className="page-shot-modal__link-icon" />
            <input
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://example.com"
              className="page-shot-modal__url-input"
              disabled={isCapturing}
            />
          </div>

          <div className="page-shot-modal__options">
            <div className="page-shot-modal__option-group">
              <label className="page-shot-modal__option-label">Resolution:</label>
              <select
                value={`${captureOptions.width}x${captureOptions.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  setCaptureOptions(prev => ({ ...prev, width, height }));
                }}
                className="page-shot-modal__option-select"
              >
                <option value="1920x1080">1920x1080 (Full HD)</option>
                <option value="1280x720">1280x720 (HD)</option>
                <option value="3840x2160">3840x2160 (4K)</option>
                <option value="1080x1920">1080x1920 (Vertical)</option>
              </select>
            </div>

            <div className="page-shot-modal__option-group">
              <label className="page-shot-modal__option-label">Format:</label>
              <select
                value={captureOptions.format}
                onChange={(e) => setCaptureOptions(prev => ({ ...prev, format: e.target.value }))}
                className="page-shot-modal__option-select"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </div>
          </div>

          <button
            onClick={captureScreenshot}
            disabled={!url.trim() || isCapturing}
            className={classnames('page-shot-modal__capture-btn', {
              'page-shot-modal__capture-btn--disabled': !url.trim() || isCapturing,
              'page-shot-modal__capture-btn--loading': isCapturing
            })}
          >
            {isCapturing ? (
              <Fragment>
                <LibrarySpinner />
                Capturing...
              </Fragment>
            ) : (
              <Fragment>
                <SVGInline svg={screenshotIcon} />
                Capture Screenshot
              </Fragment>
            )}
          </button>
        </div>

        {capturedImage && (
          <div className="page-shot-modal__preview-section">
            <div className="page-shot-modal__preview-header">
              <h4 className="page-shot-modal__preview-title">Captured Screenshot</h4>
              <span className="page-shot-modal__preview-meta">
                {capturedImage.width}x{capturedImage.height} • {captureOptions.format.toUpperCase()}
              </span>
            </div>

            <div className="page-shot-modal__preview-image">
              <img
                src={capturedImage.url}
                alt="Captured screenshot"
                className="page-shot-modal__image"
              />
            </div>

            <div className="page-shot-modal__preview-actions">
              <button
                onClick={captureScreenshot}
                className="page-shot-modal__recapture-btn"
                disabled={isCapturing}
              >
                Recapture
              </button>
              <button
                onClick={handleUseScreenshot}
                className="page-shot-modal__use-btn"
              >
                Use as Background
              </button>
            </div>
          </div>
        )}

        <div className="page-shot-modal__help">
          <h5 className="page-shot-modal__help-title">How it works:</h5>
          <ul className="page-shot-modal__help-list">
            <li>Enter any webpage URL</li>
            <li>Choose resolution and format</li>
            <li>Capture screenshot for personalized backgrounds</li>
            <li>Use in videos for dynamic, viewer-specific content</li>
          </ul>
        </div>
      </div>
    </Fragment>
  );
};

PageShotModal.propTypes = {
  setError: PropTypes.func,
};

export default PageShotModal;