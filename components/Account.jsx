import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import Bb from 'bluebird';
import { useRouter } from 'next/router';

import useUserStore from './hooks/useUserStore';
import { LibrarySpinner } from './media/Loader';

import AccountAvatar from './common/account/AccountAvatar';
import AccountField from './common/account/AccountField';
import AccountPasswordField from './common/account/AccountPasswordField';

import { showError, showSuccess } from '../lib/services/alertService';

import generalIcon from '../public/static/svgImages/account/general-icon.svg';
import passwordIcon from '../public/static/svgImages/account/password-icon.svg';
import apiKeyIcon from '../public/static/svgImages/account/api-key-icon.svg';

const TABS = {
  GENERAL: { label: 'General', icon: generalIcon, url: 'general' },
  PASSWORD: { label: 'Password', icon: passwordIcon, url: 'password' },
  KEYS: { label: 'Api key', icon: apiKeyIcon, url: 'api-keys' },
};

const Account = observer(() => {
  const router = useRouter();
  const userStore = useUserStore();
  const {
    apiKey,
    externalApiKey,
    photo,
    setApiKey,
    setExternalApiKey,
    updateUser,
    hasPermissions,
    setUserPhoto,
    setFullName,
  } = userStore;

  const [activeTab, setActiveTab] = useState(TABS.GENERAL.url);
  const userData = useMemo(() => userStore.accountDataArray,
    [userStore?.accountDataArray]);
  const [userName, setUserName] = useState(userData.USERNAME.input || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveTab(router.query.tab
    && Object.keys(TABS).some((key) => TABS[key].url === router.query.tab)
      ? router.query.tab : TABS.GENERAL.url);
  }, []);

  useEffect(() => {
    router.push({
      query: { tab: activeTab },
    });

    if (activeTab === TABS.KEYS.url && apiKey === 'Not set') {
      fillKeysFields();
    }
  }, [activeTab]);

  const fillKeysFields = async () => {
    setLoading(true);
    await Bb.all([
      setApiKey(),
      setExternalApiKey(),
    ]).then(() => setLoading(false))
      .catch(() => setLoading(false));
  };

  const onUploadImage = async ({ url }) => {
    if (url) {
      try {
        await updateUser({ photoUrl: url });
        setUserPhoto(url);
        showSuccess('User avatar is successfully uploaded!');
      } catch (e) {
        showError(e.message);
      }
    }
  };

  const onChangePassword = async (password, currentPassword) => {
    try {
      await userStore.changePassword(password, currentPassword);
      showSuccess('Password is successfully changed!');
    } catch (e) {
      showError('Incorrect current password');
    }
  };

  const onUsernameChange = ({ target }) => {
    setUserName(target.value);
  };

  const onUsernameSave = async () => {
    if (userName) {
      try {
        await updateUser({ fullName: userName });
        setFullName(userName);
        showSuccess('Username is successfully changed!');
      } catch (e) {
        showError(e.message);
      }
    }
  };

  const currentPage = useMemo(() => {
    switch (activeTab) {
      case TABS.PASSWORD.url: {
        return <AccountPasswordField updatePassword={onChangePassword} />;
      }
      case TABS.KEYS.url: {
        return (
          <>
            {loading ? (
              <LibrarySpinner />
            ) : (
              <>
                <AccountField
                  item={userData.API_KEY}
                  hasPermissions={hasPermissions}
                />
                <AccountField
                  item={userData.EXTERNAL_API_KEY}
                  hasPermissions={hasPermissions}
                />
              </>
            )}
          </>
        );
      }
      default: return (
        <>
          <AccountField
            item={userData.USERNAME}
            value={userName}
            hasPermissions={hasPermissions}
            onChange={onUsernameChange}
            maxSymbols={24}
            variableField
          />
          <AccountField
            item={userData.EMAIL}
            hasPermissions={hasPermissions}
          />
        </>
      );
    }
  }, [userName, activeTab, apiKey, externalApiKey, loading]);

  return (
    <div className={classnames('user-panel', { 'background-dark-theme': hasPermissions })}>
      <div className="user-panel__first-level">
        <AccountAvatar
          photo={photo}
          onUploadImage={onUploadImage}
          hasPermissions={hasPermissions}
        />
        <div className="user-panel__first-level__buttons">
          {Object.keys(TABS).map((key) => (
            <button
              key={`tab-${key}`}
              className={classnames({ 'tabs-white-theme': !hasPermissions, active: activeTab === TABS[key].url })}
              onClick={() => setActiveTab(TABS[key].url)}
            >
              {TABS[key].label}
              <SVGInline
                className="user-panel__first-level__buttons__tab-icon"
                svg={TABS[key].icon}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="user-panel__second-level">
        <div className="user-panel__info-panel">
          <span className={classnames('user-panel__info-panel-username', { 'label-dark-theme': hasPermissions })}>
            {`Hi ${userData.USERNAME.input}`}
          </span>
        </div>
        <div className={classnames('user-panel__data', { 'fields-dark-theme': hasPermissions })}>
          {currentPage}
        </div>
        {(activeTab !== TABS.PASSWORD.url && activeTab !== TABS.KEYS.url) && (
          <div className="user-panel__buttons-box">
            <div className="user-panel__data-field-label" />
            <div className="user-panel__data-field-button">
              <button
                disabled={!userName || userName === userData.USERNAME.input}
                className="user-panel__buttons-box-button"
                onClick={onUsernameSave}
              >
                Save
              </button>
            </div>
            <div className="user-panel__data-field-link" />
          </div>
        )}
      </div>
    </div>
  );
});

export default Account;
