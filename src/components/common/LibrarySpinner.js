import Loader from './Loader.js';

export default class LibrarySpinner extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      className: 'library-spinner',
      size: 50,
      color: '#EB5054'
    });
  }
}