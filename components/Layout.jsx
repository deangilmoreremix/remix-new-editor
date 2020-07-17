import React, { Component } from 'react';
import Head from 'next/head';
import { Provider } from 'mobx-react';

import 'styles/index.scss';

import Header from './Header';
import UnauthorizedView from './common/UnauthorizedView';

import ModalContainer from './common/ModalContainer';
import { init, initCreateStores } from '../globals/storesCreator';

import PopcornProxy from '../lib/PopcornProxy';

import PropTypes from '../lib/PropTypes';

import Intercom from './common/Intercom';
import HelpCrunch from './common/HelpCrunch';

import { DEFAULT_TITLE } from '../lib/constants/project';

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

    const { userStore: { hasPermissions } } = this.stores;
    this.hasPermissions = hasPermissions;
  }

  render() {
    if (process.browser) {
      PopcornProxy.init(window);
    }
    const { children } = this.props;
    return (
      <Provider {...this.stores}>
        <div className="layout-container">
          <Head>
            <title>{DEFAULT_TITLE}</title>
            <link
              rel="shortcut icon"
              href={
                this.stores.common.whiteLabelManager.shouldOverride
                  ? `//cdn.vidcloud.io/wl/${this.stores.common.whiteLabelManager.domain}/resources/vc_favicon`
                  : '//cdn.vidcloud.io/resources/revolution/favicon.png'
              }
            />
          </Head>
          {this.hasPermissions ? (
            <div>
              <Header {...this.props} />
              <div {...this.props} className="main">
                <ModalContainer />
                {children}
                {this.stores.userStore.currentUser && this.stores.common.whiteLabelManager && this.stores.common.whiteLabelManager.domain === 'videoremix.io'
                  ? (
                    <HelpCrunch user={this.stores.userStore.currentUser} />
                  ) : null}
              </div>
            </div>
          )
            : <UnauthorizedView />}
        </div>
      </Provider>
    );
  }
}

Layout.propTypes = {
  children: PropTypes.element.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  stores: PropTypes.any,
  // eslint-disable-next-line react/forbid-prop-types
  creator: PropTypes.any,
};

export default Layout;
