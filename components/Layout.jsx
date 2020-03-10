import React, { Component } from 'react';
import { Provider } from 'mobx-react';
import Head from 'next/head';

import 'styles/index.scss';

import { init, initCreateStores } from '../globals/storesCreator';

import PropTypes from '../lib/PropTypes';
import Header from './Header';
import Footer from './Footer';

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
    return (
      <Provider {...this.stores} api={this.api}>
        <div className="layout-container">
          <Head>
            <title>New Video Editor</title>
          </Head>
          <Header {...this.props} />
          <div {...this.props} className="main">
            {this.props.children}
          </div>
          <Footer />
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
