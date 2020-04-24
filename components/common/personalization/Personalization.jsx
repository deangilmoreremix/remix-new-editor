import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import { tokens, tokenModes, INPUT_PLACEHOLDER } from '../../../lib/constants/tokens';

import svgCogWheel from '../../../public/static/images/cogwheel.svg';

const Personalization = ({ closeModal }) => {
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
          <p className="personalization__header__title">Personalizer</p>
          <button
            className="personalization__close"
            type="button"
            onClick={() => closeModal()}
          >
            X
          </button>
        </div>

        <div className="personalization__body">
          <div className={classnames('personalization__list', { personalization__list__border: tokens.length > 9 })}>
            {
              tokens.map((item, i) => (
                <div className="personalization__items">
                  <SVGInline
                    className={classnames('radio-button-icon', { personalization__svg__active: token === item })}
                    svg={svgCogWheel}
                    cleanup={['title']}
                  />
                  <button
                    type="button"
                    className={classnames('personalization__item', { 'personalization__item-active': token === item })}
                    key={item}
                    tabIndex={i}
                    onClick={() => setToken(item)}
                  >
                    {item}
                  </button>
                </div>
              ))
            }
          </div>

          <div className="personalization__info">
            <div>
              <p className="personalization__name">{token || ''}</p>
              <div className="personalization__item__right">
                {
                  Object.keys(tokenModes).map((item, i) => (
                    <div className={classnames('personalization__item__container', { 'item-fallback': item === 'fallbackValue' })}>
                      <button
                        type="button"
                        className={classnames('personalization__item', { 'personalization__item-active': tokenState === tokenModes[item] })}
                        key={tokenModes[item]}
                        tabIndex={i}
                        onClick={() => setTokenState(tokenModes[item])}
                      >
                        {tokenModes[item]}
                      </button>
                      {item === 'fallbackValue'
                      && (
                        <input
                          className="personalization__input"
                          type="text"
                          disabled={disabled}
                          ref={inputRef}
                          placeholder={INPUT_PLACEHOLDER}
                        />
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
            <button className="personalization__add" type="button">+ add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

Personalization.propTypes = {
  closeModal: PropTypes.func.isRequired,
};

export default Personalization;
