import PropTypes from '../PropTypes';

const ListPropType = PropTypes.shape({
  items: PropTypes.arrayOrObservableArray.isRequired,
  isLoading: PropTypes.bool.isRequired,
  hasMoreData: PropTypes.bool.isRequired,
  page: PropTypes.number.isRequired,
  perPage: PropTypes.number.isRequired,
  content: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.func,
  ]).isRequired,
  filter: PropTypes.shape({}),
  orderBy: PropTypes.shape({}),
  query: PropTypes.string,
  path: PropTypes.string.isRequired,
  init: PropTypes.bool.isRequired,
  activeItem: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.string,
  ]),
}).isRequired;

export default ListPropType;
