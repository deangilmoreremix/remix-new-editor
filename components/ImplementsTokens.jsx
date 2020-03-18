import React, {useState, useRef} from "react";
import cn from 'classnames';

const systemDefaults = [
    'firstname',
    'lastname',
    'email',
    'geocountry',
    'geocity',
    'geostate',
    'name',
    'gender',
    'custom'
];

const radioBtns = ['Plain', 'Fallback value:' , 'UPPERCASE']

const ImplementsToken = () => {
    const [listItem, setListItem] = useState(systemDefaults[0]);
    const [radio, setRadio] = useState(radioBtns[0]);
    const [activeInput, setActiveInput] = useState(true);
    const input = useRef(null);

    const hanbleChangeRadio = async(value) => {
        setRadio(value);
        if (value === radioBtns[1]) {
            await setActiveInput(false);
            await input.current.focus();
        } else {
            setActiveInput(true);
        }
    };

    return (
        <div className="implements">
            <div className="implements__wrapper">
                <div className="implements__header">
                    <p>Personalizer</p>
                    <button className='implements__close'>X</button>
                </div>

                <div className="implements__body">
                    <ul className="implements__list">
                        {
                            systemDefaults.map(item => (
                                <li
                                    className={cn('implements__item', {'implements__item-active': listItem === item})}
                                    key={item}
                                    onClick={() => setListItem(item)}
                                >
                                    {item}
                                </li>
                            ))
                        }
                    </ul>

                    <div className="implements__info">
                        <div>
                            <p className="implements__name">{listItem ? listItem : ''}</p>
                            <ul>
                                {
                                    radioBtns.map(item => (
                                        <li
                                            className={cn('implements__item', {'implements__item-active': radio === item})}
                                            key={item}
                                            onClick={() => hanbleChangeRadio(item)}
                                        >
                                            {item}
                                        </li>
                                    ))
                                }
                            </ul>
                            <div className='implements__block-input' onClick={() => hanbleChangeRadio(radioBtns[1])}>
                                <input className="implements__input" type="text" disabled={activeInput} ref={input} />
                            </div>
                        </div>
                        <button className='implements__add'>add</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImplementsToken;