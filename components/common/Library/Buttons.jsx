import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

const Buttons = ({ activeBtn, setActiveBtn, btns, title }) => {
  const handleClick = name => () => setActiveBtn(name);

  return (
    <div>
      <p>{title}</p>
      <div className="library-layout__btns">
        {
          btns.map(item => (
            <button
              type="button"
              key={item.name}
              className={classnames('library-layout__btn', { 'library-layout__btn-active': activeBtn === item.name })}
              onClick={handleClick(item.name)}
            >
              <SVGInline
                classSuffix=""
                svg={item.icon || ''}
                cleanup={[item.name]}
                alt="img"
              />
              <p>{item.name}</p>
            </button>
          ))
        }
      </div>
    </div>
  );
};

Buttons.propTypes = {
  activeBtn: PropTypes.string,
  setActiveBtn: PropTypes.func,
  btns: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
  })),
  title: PropTypes.string,
};

Buttons.defaultProps = {
  title: 'Find Free Photos',
};

export default Buttons;
