import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';

import { tokens, tokenModes } from '../lib/constants/tokens';

const Personalization = () => {
  const [token, setToken] = useState(tokens[0]);
  const [tokenState, setTokenState] = useState(tokenModes[0]);
  const [disabled, setDisabled] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    if (tokenState === tokenModes[1]) {
      setDisabled(false);
    } else {
      setDisabled(true);
    }
  }, [tokenState]);

  useEffect(() => {
    if (!disabled) inputRef.current.focus();
  }, [disabled]);

  const handleChangeListItem = value => () => setToken(value);

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
              tokens.map((item, i) => (
                <button
                  type="button"
                  className={classnames('implements__item', { 'implements__item-active': token === item })}
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
              <p className="implements__name">{token || ''}</p>
              <div>
                {
                  tokenModes.map((item, i) => (
                    <button
                      type="button"
                      className={classnames('implements__item', { 'implements__item-active': tokenState === item })}
                      key={item}
                      tabIndex={i}
                      onClick={() => setTokenState(item)}
                    >
                      {item}
                    </button>
                  ))
                }
              </div>
              <div>
                <input className="implements__input" type="text" disabled={disabled} ref={inputRef} />
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
