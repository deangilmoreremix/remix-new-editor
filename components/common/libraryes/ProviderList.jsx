import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const ProviderList = ({ activeItem, onSelectItem, items, title }) => (
  <div>
    <p>{title}</p>
    <div className="library-layout__btns">
      { items && items.length
          && items.map(item => (
            <button
              type="button"
              key={item.name}
              className={classnames('library-layout__btn', { 'library-layout__btn-active': activeItem === item.name })}
              onClick={() => onSelectItem(item.name)}
            >
              {item.icon && (
              <SVGInline
                classSuffix=""
                svg={item.icon}
                cleanup={[item.name]}
                alt=""
              />
              )}
              <p>{item.name}</p>
            </button>
          ))}
    </div>
  </div>
);

ProviderList.propTypes = {
  activeItem: PropTypes.string,
  onSelectItem: PropTypes.func.isRequired,
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
  })),
  title: PropTypes.string,
};

ProviderList.defaultProps = {
  title: 'Find Free Photos',
};

export default ProviderList;
