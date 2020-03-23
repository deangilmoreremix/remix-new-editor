import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';

import { tokens, tokenModes } from '../lib/constants/tokens';

const Personalization = () => {
  const [token, setToken] = useState(tokens[0]);
  const [tokenState, setTokenState] = useState(tokenModes.plain);
  const [disabled, setDisabled] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    setDisabled(tokenState !== tokenModes.fallbackValue);
  }, [tokenState]);

  useEffect(() => {
    if (!disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="personalization">
      <div className="personalization__wrapper">
        <div className="personalization__header">
          <p>Personalizer</p>
          <button className="personalization__close" type="button">X</button>
        </div>

        <div className="personalization__body">
          <div className="personalization__list">
            {
              tokens.map((item, i) => (
                <button
                  type="button"
                  className={classnames('personalization__item', { 'personalization__item-active': token === item })}
                  key={item}
                  tabIndex={i}
                  onClick={() => setToken(item)}
                >
                  {item}
                </button>
              ))
            }
          </div>

          <div className="personalization__info">
            <div>
              <p className="personalization__name">{token || ''}</p>
              <div>
                {
                  Object.keys(tokenModes).map((item, i) => (
                    <button
                      type="button"
                      className={classnames('personalization__item', { 'personalization__item-active': tokenState === tokenModes[item] })}
                      key={tokenModes[item]}
                      tabIndex={i}
                      onClick={() => setTokenState(tokenModes[item])}
                    >
                      {tokenModes[item]}
                    </button>
                  ))
                }
              </div>
              <input className="personalization__input" type="text" disabled={disabled} ref={inputRef} />
            </div>
            <button className="personalization__add" type="button">add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Personalization;
