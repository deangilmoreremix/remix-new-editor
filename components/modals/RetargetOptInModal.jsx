import React, { useState, useRef } from 'react';
import { observer } from 'mobx-react';
import arrayMove from 'array-move';
import { Box, List, ListItem, Button, IconButton } from '@material-ui/core';

import { optInTemplate } from '../../lib/generators/iframe';

import FormTextArea from '../form/FormTextArea';

import useProjectStore from '../hooks/useProjectStore';

const RetargetOptInModal = observer(({ handleClose }) => {
  const projectStore = useProjectStore();
  const { getPersonalization } = projectStore;
  const [tokens, toggleTokens] = useState(getPersonalization());
  const textareaRef = useRef();

  const moveToken = (oldIndex, newIndex) => {
    if (newIndex < 0 || newIndex >= tokens.length) return;
    const movedTokens = arrayMove(tokens, oldIndex, newIndex);
    toggleTokens(movedTokens);
    const textarea = textareaRef.current;
    textarea.select();
  };

  return (
    <div className="retarget-opt-in-modal">
      <Box> 1) Reorder personalized tokens by dragging as they defined at your form:</Box>
      <List component="nav" aria-label="secondary">
        {tokens.map((value, index) => (
          <ListItem key={`sortable-item-${value}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{value}</span>
            <IconButton
              size="small"
              disabled={index === 0}
              onClick={() => moveToken(index, index - 1)}
              aria-label="move up"
            >
              ↑
            </IconButton>
            <IconButton
              size="small"
              disabled={index === tokens.length - 1}
              onClick={() => moveToken(index, index + 1)}
              aria-label="move down"
            >
              ↓
            </IconButton>
          </ListItem>
        ))}
      </List>
      <Box> 2) Copy & Paste this embed code inside the custom HTML element:</Box>
      <FormTextArea
        inputClassName="opt-in-textarea"
        rows={10}
        inputRef={textareaRef}
        value={optInTemplate(tokens)}
        multiline
      />
      <Box>
        <Button
          variant="outlined"
          color="default"
          className="done-button"
          onClick={handleClose}
        >
          Done
        </Button>
      </Box>
    </div>
  );
});

export default RetargetOptInModal;
