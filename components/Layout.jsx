import React, { Component } from 'react';
import Head from 'next/head';
import { Provider } from 'mobx-react';
import PropTypes from '../lib/PropTypes';

import 'styles/index.scss';

import { initStoreAndPreload, initStore } from '../globals/store';

class Layout extends Component {
  static async getInitialProps({ query, req }, preloader) {
    const isServer = !!req;
    const store = await initStoreAndPreload(isServer, query, req, preloader);
    return { store };
  }

  constructor(props) {
    super(props);
    this.store = initStore(props.store);
  }

  render() {
    const { children } = this.props;
    return (
      <Provider store={this.store} api={this.api}>
        <Head>
          <title>New Video Editor</title>
        </Head>
        <div {...this.props} className="main">
          {children}
        </div>
      </Provider>
    );
  }
}

Layout.propTypes = {
  children: PropTypes.element.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  store: PropTypes.any,
};

export default Layout;
