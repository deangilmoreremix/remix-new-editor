/**
 * Created by Eugene Butusov on 02/11/2018.
 */

class AbstractProvider {
  constructor(config) {
    this.config = config;
  }

  init() {
    throw new Error('Should be overridden in child class.');
  }

  isAuthorized() {
    throw new Error('Should be overridden in child class.');
  }

  logIn() {
    throw new Error('Should be overridden in child class.');
  }

  publish() {
    throw new Error('Should be overridden in child class.');
  }
}

export default AbstractProvider;
