import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import { systemDefaults, radioBtns } from '../lib/constants/tokens';


const Personalization = () => {
  const [listItem, setListItem] = useState(systemDefaults[0]);
  const [radio, setRadio] = useState(radioBtns[0]);
  const [activeInput, setActiveInput] = useState(true);
  const inputRef = useRef(null);

  const handleChangeRadio = value => () => setRadio(value);

  useEffect(() => {
    if (radio === radioBtns[1]) {
      setActiveInput(false);
    } else {
      setActiveInput(true);
    }
  }, [radio]);

  useEffect(() => {
    if (!activeInput) inputRef.current.focus();
  }, [activeInput]);

  const handleChangeListItem = value => () => setListItem(value);

  return (
    <div className="implements">
      <div className="implements__wrapper">
        <div className="implements__header">
          <p>Personalizer</p>
          <button className="implements__close" type="button">X</button>
        </div>

        <div className="implements__body">
          <div className="implements__list">
            {
              systemDefaults.map((item, i) => (
                <button
                  type="button"
                  className={classnames('implements__item', { 'implements__item-active': listItem === item })}
                  key={item}
                  tabIndex={i}
                  onClick={handleChangeListItem(item)}
                >
                  {item}
                </button>
              ))
            }
          </div>

          <div className="implements__info">
            <div>
              <p className="implements__name">{listItem || ''}</p>
              <div>
                {
                  radioBtns.map((item, i) => (
                    <button
                      type="button"
                      className={classnames('implements__item', { 'implements__item-active': radio === item })}
                      key={item}
                      tabIndex={i}
                      onClick={handleChangeRadio(item)}
                    >
                      {item}
                    </button>
                  ))
                }
              </div>
              <div>
                <input className="implements__input" type="text" disabled={activeInput} ref={inputRef} />
              </div>
            </div>
            <button className="implements__add" type="button">add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Personalization;
