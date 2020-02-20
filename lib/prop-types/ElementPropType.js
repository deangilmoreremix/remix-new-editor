import PropTypes from '../PropTypes';

const ElementPropType = PropTypes.shape({
  key: PropTypes.string.isRequired,
  kind: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  start: PropTypes.number,
  position: PropTypes.shape({
    top: PropTypes.number,
    left: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
  }),
});

export default ElementPropType;
