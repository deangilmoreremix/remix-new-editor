import React, { Component } from 'react';
import Head from 'next/head';
import { Provider } from 'mobx-react';
import PropTypes from '../lib/PropTypes';

import 'styles/index.scss';

import { init, initCreateStores } from '../globals/storesCreator';

class Layout extends Component {
  static async getInitialProps({ query, req }, preloader) {
    const isServer = !!req;
    const stores = await initCreateStores(isServer, query, req, preloader);
    return { stores };
  }

  constructor(props) {
    super(props);

    this.stores = init(props.stores);
  }

  render() {
    const { children } = this.props;
    return (
      <Provider {...this.stores} api={this.api}>
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
