import React, { Component } from 'react';
import Head from 'next/head';
import { Provider } from 'mobx-react';
import PropTypes from '../lib/PropTypes';

import PopcornProxy from '../lib/PopcornProxy';
import 'styles/index.scss';

import { init, initCreateStores } from '../globals/storesCreator';
import ModalContainer from './common/ModalContainer';

class Layout extends Component {
  static async getInitialProps({ query, req }, preloader) {
    const isServer = !!req;
    const data = await initCreateStores(isServer, query, req, preloader);
    return { ...data };
  }

  constructor(props) {
    super(props);
    const data = init(props.creator);
    this.stores = data.stores;
  }

  render() {
    if (process.browser) {
      PopcornProxy.init(window);
    }
    const { children } = this.props;
    return (
      <Provider {...this.stores}>
        <Head>
          <title>New Video Editor</title>
        </Head>
        <div {...this.props} className="main">
          <ModalContainer />
          {children}
        </div>
      </Provider>
    );
  }
}

Layout.propTypes = {
  children: PropTypes.element.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  stores: PropTypes.any,
};

export default Layout;
