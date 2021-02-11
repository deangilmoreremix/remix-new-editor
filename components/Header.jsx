import React from 'react';

import MenuAppBar from './MenuAppBar';

import { DOMAIN_VIDEOREMIX } from '../lib/constants/project';
import useUserStore from './hooks/useUserStore';

import PropTypes from '../lib/PropTypes';

function Header({ whiteLabelManager, fbPixelId, scriptStatistic }) {
  const { currentUser } = useUserStore();

  return (
    <header className="menu-app-bar">
      <MenuAppBar whiteLabelManager={whiteLabelManager} />
      {whiteLabelManager.domain === DOMAIN_VIDEOREMIX
      && scriptStatistic && (
        <>
          <script dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                   n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script',
                  'https://connect.facebook.net/en_US/fbevents.js');
                  fbq('init', ${fbPixelId});
                  fbq('track', 'PageView', {'current_user_id': '${currentUser.id}', current_user_email: '${currentUser.email}'});`,
          }}
          />
          <noscript dangerouslySetInnerHTML={{
            __html: `<img
                    height="1"
                    width="1"
                    style="display:none"
                    src='https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1'/>`,
          }}
          />
        </>
      )}
    </header>
  );
}

Header.propTypes = {
  whiteLabelManager: PropTypes.shape({
    domain: PropTypes.string,
  }),
  fbPixelId: PropTypes.number,
  scriptStatistic: PropTypes.string,
};

export default Header;
