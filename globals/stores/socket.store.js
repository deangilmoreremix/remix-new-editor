import { action } from 'mobx';
import { socket } from '../socket-io';

export default class SocketStore {
  @action
  subscribeToSocketEvent = (eventType, handler) => {
    socket.instance.on(eventType, (event) => handler(event));
  }

  @action
  unsubscribeToSocketEvent = (eventType, handler) => {
    socket.instance.removeListener(eventType, handler);
  }
}
