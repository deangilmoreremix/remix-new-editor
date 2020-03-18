import React from 'react';
import cn from 'classnames';
import SVGInline from 'react-svg-inline';
import PropTypes from '../../lib/PropTypes';

const Buttons = ({ activeBtn, setActiveBtn, btns }) => (
  <div>
    <p>Find Free Photos</p>
    <div className="library-layout__btns">
      {
        btns.map(item => (
          <button key={item.name} className={cn('library-layout__btn', { 'library-layout__btn-active': activeBtn === item.name })} onClick={() => setActiveBtn(item.name)}>
            <SVGInline
              classSuffix=""
              svg={item.icon}
              cleanup={['title']}
              alt="img"
            />
            <span>{item.name}</span>
          </button>
        ))
    }
    </div>
  </div>
);

Buttons.propTypes = {
  activeBtn: PropTypes.string,
  setActiveBtn: PropTypes.func,
  btns: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, icon: PropTypes.string })),
};

export default Buttons;
