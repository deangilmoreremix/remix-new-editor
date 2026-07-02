import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';

import { tokens, tokenModes, CUSTOM, INPUT_PLACEHOLDER } from '../../lib/constants/tokens';

const Personalization = ({ closeModal, tokenList, onAdd, elementType, tokenModes: tokenModesProp }) => {
  const effectiveTokenList = tokenList || tokens;
  const effectiveTokenModes = tokenModesProp || tokenModes;
  const [token, setToken] = useState(effectiveTokenList[0]);
  const [tokenState, setTokenState] = useState(effectiveTokenModes.plain);
  const [disabled, setDisabled] = useState(true);
  const [fallbackValue, setFallbackValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setDisabled(tokenState !== effectiveTokenModes.fallbackValue);
  }, [tokenState, effectiveTokenModes]);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleAdd = () => {
    const tokenValue = token === CUSTOM ? fallbackValue : token;
    const formattedToken = String(tokenValue).replace(/\s/g, '').toUpperCase();
    if (!formattedToken) return;
    onAdd?.(formattedToken);
    closeModal?.();
  };

  return (
    <div className="personalization">
      <div className="personalization__wrapper">
        <div className="personalization__header">
          <p>Personalizer</p>
          <button className="personalization__close" type="button" onClick={closeModal}>X</button>
        </div>

        <div className="personalization__body">
          <div className="personalization__list">
            {effectiveTokenList.map((item, i) => (
              <button
                type="button"
                className={classnames('personalization__item', { 'personalization__item-active': token === item })}
                key={item}
                tabIndex={i}
                onClick={() => setToken(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="personalization__info">
            <div>
              <p className="personalization__name">{token || ''}</p>
              <div>
                {Object.keys(effectiveTokenModes).map((item, i) => (
                  <button
                    type="button"
                    className={classnames('personalization__item', { 'personalization__item-active': tokenState === effectiveTokenModes[item] })}
                    key={effectiveTokenModes[item]}
                    tabIndex={i}
                    onClick={() => setTokenState(effectiveTokenModes[item])}
                  >
                    {effectiveTokenModes[item]}
                  </button>
                ))}
              </div>
              <input
                className="personalization__input"
                type="text"
                disabled={tokenState !== effectiveTokenModes.fallbackValue}
                ref={inputRef}
                value={fallbackValue}
                onChange={(e) => setFallbackValue(e.target.value)}
                placeholder={INPUT_PLACEHOLDER}
              />
            </div>
            <button className="personalization__add" type="button" onClick={handleAdd}>add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Personalization;
