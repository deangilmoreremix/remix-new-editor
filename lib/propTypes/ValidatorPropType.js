import PropTypes from '../PropTypes';

const ValidatorPropType = PropTypes.shape({
  type: PropTypes.string.isRequired,
  isRequired: PropTypes.bool,
  message: PropTypes.string,
  validationType: PropTypes.string,
});

export default ValidatorPropType;
