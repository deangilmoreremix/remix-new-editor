import PropTypes from '../PropTypes';
import ElementPropType from './ElementPropType';
import AssetPropType from './AssetPropType';

const ProjectPropType = PropTypes.shape({
  _id: PropTypes.string,
  source: PropTypes.shape({}).isRequired,
  cover: PropTypes.string,
  thumbnails: PropTypes.arrayOrObservableArray(PropTypes.shape({
    showAt: PropTypes.number.isRequired,
    url: PropTypes.string.isRequired,
  })),
  version: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  preview: PropTypes.string,
  artifact: PropTypes.string,
  galleryItems: PropTypes.arrayOrObservableArray(PropTypes.shape({
    type: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  images: PropTypes.arrayOrObservableArray(PropTypes.shape({
    type: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  audios: PropTypes.arrayOrObservableArray(PropTypes.shape({
    type: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    title: PropTypes.string,
  })),
  elements: PropTypes.arrayOrObservableArray(ElementPropType),
  assets: PropTypes.arrayOrObservableArray(AssetPropType),
  filter: PropTypes.string,
});

export default ProjectPropType;
