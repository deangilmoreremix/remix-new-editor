export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

export const MessageStatus = {
  SENDING: 'sending',
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

export const ConversationStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
};

export const AttachmentType = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  START_FRAME: 'startFrame',
  END_FRAME: 'endFrame',
};
