import React, { Component, Fragment } from 'react';
import { inject, observer } from 'mobx-react';
import ImageEditor from 'react-avatar-editor';
import { action } from 'mobx';

import PropTypes from '../../lib/PropTypes';
import { showError } from '../../lib/services/alertService';
import MediaTypeDetector from '../../lib/utils/mediaTypeDetector';
import InfiniteLoading from './InfiniteLoading';


@inject('mediaStore')
@observer
class ImageCropper extends Component {
  constructor(props) {
    super(props);
    const {
      resolution,
    } = props;

    this.state = {
      isLoading: false,
      width: resolution.width,
      height: resolution.height,
    };
  }

  @action
  onLoadSuccess = async () => {
    if (this.editor) {
      await this.uploadFile(this.editor.getImageScaledToCanvas().toDataURL('image/png'));
    }
  };

  setEditorRef = editor => {
    this.editor = editor;
  };

  uploadFile = async (imageData) => {
    const { mediaStore, onImageCropped } = this.props;
    try {
      this.setState({ isLoading: true });
      const newUrl = (await mediaStore.uploadMedia({ data: imageData })).url;
      const metadata = await new MediaTypeDetector()
        .getMetadata(newUrl);
      if (!metadata.contentType.includes('image')) {
        return showError('Image not found');
      }
      onImageCropped(metadata);
    } catch (err) {
      return showError(err.message || 'This image format is not supported.');
    } finally {
      this.setState({ isLoading: false });
    }
  };

  render() {
    const {
      props: { className, imageData },
      state: { isLoading, width, height },
    } = this;
    return (
      <div className="image-crop-content">
        {isLoading ? <InfiniteLoading className="auto-margin" />
          : (
            <Fragment>
              <h5 className="crop-title">
                It seems your image is not fitting required resolution.
                {' '}
                <br />
                Please select desired area and image will be adjusted to required size.
              </h5>
              <div className="canvas-container">
                <ImageEditor
                  className={className}
                  ref={this.setEditorRef}
                  crossOrigin="anonymous"
                  image={imageData.source}
                  width={width}
                  height={height}
                  border={50}
                  scale={1}
                  rotate={0}
                />
              </div>
              <button className="go-button submit-button save-button" onClick={this.onLoadSuccess} type="button">
                Save
              </button>
            </Fragment>
          )}
      </div>
    );
  }
}

ImageCropper.propTypes = {
  className: PropTypes.string,
  imageData: PropTypes.shape({
    source: PropTypes.string.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  resolution: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }).isRequired,
  onImageCropped: PropTypes.func.isRequired,
};

export default ImageCropper;
