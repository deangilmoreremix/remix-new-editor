import React, { useCallback } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import trashIcon from '../../../public/static/svgImages/common/trash.svg';
import textSpeechIcon from '../../../public/static/svgImages/common/textspeech.svg';
import AudioPreview from '../library/AudioPreview';

const TextToSpeechItem = ({ data, activeItem, onPlay, onSelect, onDelete }) => {
  const playStop = useCallback(() => {
    if (!activeItem || (activeItem && activeItem._id !== data._id)) {
      onPlay(data);
    } else if (activeItem && activeItem._id === data._id) {
      onPlay(null);
    }
  }, [data, activeItem]);

  const onEnded = useCallback(() => onPlay(null), [data]);

  const addItem = () => {
    onPlay(null);
    onSelect(data);
  };

  const deleteItem = () => {
    onPlay(null);
    onDelete(data._id);
  };

  return (
    <div className="text-to-speech__library-item">
      <button className="text-to-speech__library-add" onClick={addItem} />
      <button className="text-to-speech__library-delete" onClick={deleteItem}>
        <SVGInline
          svg={trashIcon}
          cleanup={['title']}
        />
      </button>

      <div className="text-to-speech__library-body">
        {activeItem && (
          <AudioPreview
            item={data}
            isActive={activeItem && activeItem._id === data._id}
            isDisplayTitle={false}
            isDisplayIcon={false}
            onEnded={onEnded}
          />
        )}
      </div>

      <button
        className={classnames('text-to-speech__library-play', { 'text-to-speech__library-play-active': activeItem && activeItem._id === data._id })}
        onClick={playStop}
      />

      <div className="text-to-speech__library-bottom">
        <SVGInline
          className="text-to-speech__library-icon"
          svg={textSpeechIcon}
          cleanup={['title']}
        />
        <p>{data.title}</p>
        <div />
      </div>
    </div>
  );
};

TextToSpeechItem.propTypes = {
  data: PropTypes.shape().isRequired,
  activeItem: PropTypes.shape(),
  onPlay: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default TextToSpeechItem;
