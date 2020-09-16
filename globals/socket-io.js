import io from 'socket.io-client';

import config from '../config/config';

export const socket = {};
export const initializeSockets = (authToken, user) => {
  if (!user) {
    return;
  }
  const socketInstance = io(`${config.loginServer.url}/editor`, {
    query: { authorization: `${authToken}`, userId: user.id },
    transports: ['websocket'],
  });

  socketInstance.emit('register', authToken);

  socketInstance.on('online', (payload) => {
    socketInstance.emit('join-room', { room: payload.data.userId });
  });

  socketInstance.on('disconnect', (payload) => ((typeof payload === 'string')
    ? console.info(payload)
    : socketInstance.emit('leave-room', { room: payload.data.userId })),
  );
  socket.instance = socketInstance;
};
