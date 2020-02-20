import PropTypes from '../PropTypes';

const AssetPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  kind: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.shape({
      content: PropTypes.string,
      font: PropTypes.shape({
        name: PropTypes.string,
        size: PropTypes.number,
        color: PropTypes.string,
      }),
    })]),
});

export default AssetPropType;
