import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Popper, Grow, ClickAwayListener, Paper } from '@material-ui/core';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import Chip from '@material-ui/core/Chip';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { AppBar, Toolbar } from '@material-ui/core';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';
import ExpandButton from './common/ExpandButton';
import HelpIconComponent from './common/HelpIcon';

import { HEADER_ACTIONS, USER_MENU_ITEMS } from '../lib/constants/ui';
import { headerTooltips,downloadTooltips } from '../lib/constants/tooltips';
import { DOMAIN_VIDEOREMIX } from '../lib/constants/project';
import { ENTER_KEY } from '../lib/constants/keyCodes';

import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
import draftIcon from '../public/static/svgImages/header/draft-icon.svg';

import publishIcon from '../public/static/svgImages/header/published-icon.svg';
import editIcon from '../public/static/svgImages/header/edit-project.svg';
import downloadIcon from '../public/static/svgImages/header/download.svg';


import useProjectStore from './hooks/useProjectStore';
import useCommonStore from './hooks/useCommonStore';
import useUserStore from './hooks/useUserStore';
import useUIStore from './hooks/useUIStore';
import useMediaStore from './hooks/useMediaStore';

import Sidebar from './Sidebar';

import PropTypes from '../lib/PropTypes';
import { useRouter } from 'next/router';
import { Button } from 'react-bootstrap';
import { saveAs } from 'file-saver';
import { isNumber } from 'lodash';

const {
  REDO,
  UNDO,
  SAVE,
  DRAFT,
  SAVEASPUBLISH,
  DOWNLOAD
} = HEADER_ACTIONS;

const MenuAppBar = observer(({ whiteLabelManager }) => {
  const anchorRef = useRef(null);
  const buttonref = useRef(null);
  const [open, setOpen] = React.useState(false);
  const qualities = [{ qua: 480, tag: "p", desc: "Standard quality" }, { qua: 720, tag: "p", desc: "Good quality" }, { qua: 1080, tag: <span>p<sup>HD</sup></span>, desc: "High quality" }]
  const [value, setValue] = React.useState('');

  const [isProjectTitle, setProjectTitle] = useState(false);
  const [userItems, setUserItems] = useState([]);
  const [disabledDraft, setDisabledDraft] = useState(false);
  const [disabledPublish, setDisabledPublish] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState();
  const {
    modified,
    undoRedoAction,
    canUndo,
    canRedo,
    checkAndSave,
    item,
    updateItem,
    verifyTitle,
    getItemTitle,
    setIsPublished,
    isPublished,
    setButtonType,
    isLoadingIosProcess
  } = useProjectStore();
  const {
    pathname,
    query: { project },
    push,
  } = useRouter();



  const common = useCommonStore();
  const { oneOfFeatureEnabled, publishEnabled, currentUser, revolutionDownloadVideoEnabled, smartaimentorsEnabled, availableDownloadVideoLimit, userVideoDownloadBalance, downloadVideoLimitUsed, updateDownloadVideoAndGetDownloadVideoLimit, getVideo, downloadVideoUrl } = useUserStore();

  const {
    showProducePanel,
    setInitialView,
    changeRadioButton,
    closeAllWindows,
  } = useUIStore();
  console.log(availableDownloadVideoLimit, "downloadVideoLimitUsed=>");
  useEffect(() => {
    if (item.published == false) {
      setDisabledDraft(true);
      setDisabledPublish(false);
    }
    if (item.published == true) {
      setDisabledPublish(true);
      setDisabledDraft(false);
    }
  }, [item.published])

  useEffect(() => {
    if (USER_MENU_ITEMS(common)) {
      const items = USER_MENU_ITEMS(common);
      setUserItems(oneOfFeatureEnabled ? items : items.filter((i) => !i.isFeatureDependence));
      setUserItems(smartaimentorsEnabled ? items : items.filter(function (item, index) {
        return index !== 1
      }))
    }
  }, []);

  const quantify = () => {
    userVideoDownloadBalance()
      .catch(() => showError('Limit Exceeded!'));
  };
  console.log(item, "item=")
  useEffect(() => quantify(), []);

  console.log(currentUser, "current-user")
  const saveProject = useCallback(async () => {
    let value = '';
    await setButtonType("");
    if (!publishEnabled) {
      await setButtonType("Project will be saved");
    }
    if (isPublished || !publishEnabled) {
      await setIsPublished(true);
    }
    await getItemTitle({}).then((data) => {
      value = data.title;
    });

    let verify_duplicate = 0;
    let key = "togetherjs-session.status";
    let sessionVal = sessionStorage.getItem(key);
    if (!sessionVal) {
      await verifyTitle({}).then((data) => {
        for (let i = 0; i < data.result.length; i++) {
          if (data.cur_item !== data.result[i]._id && data.result[i].title.toUpperCase() === value.toUpperCase()) {
            verify_duplicate = 1;
          }
        }
      });
    }

    if (verify_duplicate === 0) {
      checkAndSave({ changeRadioButton, showProducePanel, closeAllWindows, setInitialView });
    } else {
      swal('Error', 'Project name already exists!', 'error');
    }
  }, [setInitialView, showProducePanel])

  const saveProjectAsPublished = useCallback(async () => {
    let value = '';
    await setIsPublished(true);
    await setButtonType('Project will now be Published');
    await getItemTitle({}).then((data) => {
      value = data.title;
    });

    let verify_duplicate = 0;
    let key = "togetherjs-session.status";
    let sessionVal = sessionStorage.getItem(key);
    if (!sessionVal) {
      await verifyTitle({}).then((data) => {
        for (let i = 0; i < data.result.length; i++) {
          if (data.cur_item !== data.result[i]._id && data.result[i].title.toUpperCase() === value.toUpperCase()) {
            verify_duplicate = 1;
          }
        }
      });
    }

    if (verify_duplicate === 0) {
      checkAndSave({ changeRadioButton, showProducePanel, closeAllWindows, setInitialView });
    } else {
      swal('Error', 'Project name already exists!', 'error');
    }
  }, [setInitialView, showProducePanel])

  // const downloadVideo = useCallback(async (quality) => {
  //   const total = downloadVideoLimitUsed + 1;
  //   saveAs(item.iosurl, item.title);
  //   updateDownloadVideoAndGetDownloadVideoLimit({ videoDownloadCredit: total })
  // }, [item.iosurl, downloadVideoLimitUsed]);



  const saveProjectAsDraft = useCallback(async () => {
    let value = '';
    await setIsPublished(false);
    await setButtonType('Project should be saved as Draft')
    await getItemTitle({}).then((data) => {
      value = data.title;
    });

    let verify_duplicate = 0;
    let key = "togetherjs-session.status";
    let sessionVal = sessionStorage.getItem(key);
    if (!sessionVal) {
      await verifyTitle({}).then((data) => {
        for (let i = 0; i < data.result.length; i++) {
          if (data.cur_item !== data.result[i]._id && data.result[i].title.toUpperCase() === value.toUpperCase()) {
            verify_duplicate = 1;
          }
        }
      });
    }

    if (verify_duplicate === 0) {
      checkAndSave({ changeRadioButton, showProducePanel, closeAllWindows, setInitialView });
    } else {
      swal('Error', 'Project name already exists!', 'error');
    }
  }, [setInitialView, showProducePanel]);


  const updateTitle = useCallback((event) => {
    updateItem({ title: event.target.value });
  }, []);

  const onEnterKeyPress = (event) => {
    if (event.keyCode === ENTER_KEY) {
      setProjectTitle(false);
    }
  };
  const handleRadioChange = (event) => {
    setValue(event);
    // setValue(event.target.value);
  };
  // useEffect(() => {
  //   if (downloadVideoUrl) {
  //     saveAs(downloadVideoUrl, item.title)
  //   }
  // }, [downloadVideoUrl])
  const download360 = useCallback(async (quality) => {
    if (!isLoadingIosProcess && project && item.iosurl && availableDownloadVideoLimit > 0) {
      if (quality == 480) {
        saveAs(item.goodQualityUrl, `${item.title}_480px_${Date.now()}`)
      }
      else if (quality == 720) {
        saveAs(item.standardQualityUrl, `${item.title}_720px_${Date.now()}`)
      }
      else if (quality == 1080) {
        saveAs(item.iosurl, `${item.title}_1080px_${Date.now()}`)
      }
      const total = downloadVideoLimitUsed + 1;
      await updateDownloadVideoAndGetDownloadVideoLimit({ videoDownloadCredit: total })
      setOpen(false)
    }else{
      window.open("https://videoremix.io/smartvideo-pricing-page/","_blank")
    }
  }, [item.iosurl, item.standardQualityUrl, item.goodQualityUrl, downloadVideoLimitUsed, availableDownloadVideoLimit])

const handleDownload = () =>{
  if (availableDownloadVideoLimit > 0) {
    setOpen(true)
  }else{
    window.open("https://videoremix.io/smartvideo-pricing-page/","_blank")
  }
}

  return (
    <div className="container-header" ref={anchorRef}>
      <AppBar position="static" className="app-bar">
        <Toolbar className="container-menu">
          <div className="container-logo-humburger">
            <Sidebar />
            <div className="flex-vertical-center">
              {whiteLabelManager && whiteLabelManager.domain !== DOMAIN_VIDEOREMIX
                ? (<a className="navbar-logo-wl" href="/" />)
                : (
                  <SVGInline
                    className="logo flex"
                    classSuffix=""
                    svg={logoIcon}
                    cleanup={['title']}
                  />
                )}
            </div>
          </div>


          <div className={publishEnabled ? "container-menu__publishedactions" : "container-menu__saveactions"}>
            <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.undo}>
                <div>
                  <SVGInline
                    className={classnames('icon icon-button', { active: canUndo })}
                    classSuffix=""
                    svg={undoIcon}
                    cleanup={['title']}
                    component="button"
                    disabled={!canUndo}
                    onClick={() => undoRedoAction(true)}
                  />
                  <button
                    className={classnames('icon-button container-menu__button-text', { active: canUndo })}
                    disabled={!canUndo}
                    onClick={() => undoRedoAction(true)}
                  >
                    {UNDO}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
            <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.redo}>
                <div>
                  <SVGInline
                    className={classnames('icon icon-button', { active: canRedo })}
                    classSuffix=""
                    svg={redoIcon}
                    cleanup={['title']}
                    component="button"
                    disabled={!canRedo}
                    onClick={() => undoRedoAction(false)}
                  />
                  <button
                    className={classnames('icon-button container-menu__button-text', { active: canRedo })}
                    disabled={!canRedo}
                    onClick={() => undoRedoAction(false)}
                  >
                    {REDO}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
            <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.save}>
                <div>
                  <SVGInline
                    className={`icon icon-button ${modified ? 'active-save' : ''}`}
                    classSuffix=""
                    svg={saveIcon}
                    cleanup={['title']}
                    component="button"
                    onClick={saveProject}
                    disabled={!modified}
                  />
                  <button
                    className={`icon-button container-menu__button-text ${modified ? 'active-save' : ''}`}
                    onClick={saveProject}
                    disabled={!modified}
                  >
                    {SAVE}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
            {publishEnabled && <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.draft}>
                <div>
                  <SVGInline
                    className={`icon icon-button ${!disabledDraft ? 'active-save' : ''}`}
                    classSuffix=""
                    svg={draftIcon}
                    cleanup={['title']}
                    component="button"
                    onClick={saveProjectAsDraft}
                    disabled={disabledDraft}
                  />
                  <button
                    className={`icon-button container-menu__button-text ${!disabledDraft ? 'active-save' : ''}`}
                    onClick={saveProjectAsDraft}
                    disabled={disabledDraft}
                  >
                    {DRAFT}
                  </button>
                </div>
              </HelpIconComponent>
            </div>}
            {publishEnabled && <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.publish}>
                <div>
                  <SVGInline
                    className={`icon icon-button ${!disabledPublish ? 'active-save' : ''}`}
                    classSuffix=""
                    svg={publishIcon}
                    cleanup={['title']}
                    component="button"
                    onClick={saveProjectAsPublished}
                    disabled={disabledPublish}
                  />
                  <button
                    className={`icon-button container-menu__button-text ${!disabledPublish ? 'active-save' : ''}`}
                    onClick={saveProjectAsPublished}
                    disabled={disabledPublish}
                  >
                    {SAVEASPUBLISH}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
            }
            {console.log((isLoadingIosProcess && !project && !item.iosurl), "(isLoadingIosProcess && !project && !item.iosurl) || availableDownloadVideoLimit <= 0", availableDownloadVideoLimit <= 0)}
            {revolutionDownloadVideoEnabled && <div className="container-menu__actions__item">
            <HelpIconComponent noDelay noIcon message={`${downloadTooltips.value}${availableDownloadVideoLimit <= 0 ? 0 : availableDownloadVideoLimit}`}>
              <div ref={buttonref}>
                {console.log("availableDownloadVideoLimit:" + availableDownloadVideoLimit, !isLoadingIosProcess, project, item.iosurl)}
                <SVGInline
                  className={`icon icon-button ${!isLoadingIosProcess && project && availableDownloadVideoLimit > 0 && item.iosurl ? 'active-save' : ''}`}
                  classSuffix=""
                  svg={downloadIcon}
                  cleanup={['title']}
                  component="button"
                  onClick={() => handleDownload()}
                  disabled={(!project && !item.iosurl ) || isLoadingIosProcess}
                />
                <button
                  className={`icon-button container-menu__button-text ${!isLoadingIosProcess && project && availableDownloadVideoLimit > 0 && item.iosurl ? 'active-save' : ''}`}
                  onClick={() => handleDownload()}
                  disabled={(!project && !item.iosurl ) || isLoadingIosProcess}
                >
                  {DOWNLOAD}
                </button>
              </div>
              </HelpIconComponent>
            </div>
            }
          </div>

          {/* <Button onClick={() => setOpen(true)}  >360Quality</Button> */}
          <Popper
            open={open}
            role={undefined}
            transition
            disablePortal
            className="popover"
            placement="bottom"
            anchorEl={buttonref.current}
            style={{ border: "none", backgroundColor: '#4B4B61' }}
          >
            {({ TransitionProps, placement: currentPlacement }) => (
              <Grow
                {...TransitionProps}
                style={{ transformOrigin: currentPlacement === 'bottom' ? 'center top' : 'center bottom' }}
              >
                <Paper>
                  <ClickAwayListener onClickAway={() => { setOpen(false); }}>
                    <div
                      className="menu__list "
                      id="menu-list-grow"
                      style={{ backgroundColor: "#4B4B61", borderRadius: "3px" }}
                    >
                      {qualities.map((item) => {
                        return (
                          <div className='qualitymenu__item' onClick={() => download360(item.qua)}>
                            {/* <Radio
                              value={item.qua}
                              sx={{
                                "&.MuiSvgIcon-root": {
                                  color: "#c2bfbc",
                                  backgroundColor: "#e3e0dc",
                                  fontSize: "1.2em"
                                },
                              }}
                              checked={value == item.qua ? true : false}
                              checkedIcon={<CheckCircleIcon style={{ color: "#d17504" }} />}
                            /> */}
                            <div className='qualitymenu__itemdiv' onClick={() => download360(item.qua)}  ><span><span className='qualitytype'>{item.qua}{item.tag}</span> <br /><span>{item.desc}</span></span></div>
                            {/* {item.qua === 1080 && <Chip label="Plus" className='qualitymenu_chip' variant="outlined" />} */}
                          </div>
                        )
                      })}
                      {/* <RadioGroup aria-label="quality" name="quality" value={value} onChange={handleRadioChange}>
                        {qualities.map((item) => (
                          <FormControlLabel
                          className='qualitymenu__item'
                            key={item.qua}
                            value={item.qua}
                            control={
                              <Radio
                                sx={{
                                  "& .MuiSvgIcon-root": {
                                    color: "#c2bfbc",
                                    backgroundColor: "#e3e0dc",
                                    fontSize: "1.2em"
                                  },
                                }}
                                checked={value == item.qua ? true :false}
                                checkedIcon={<CheckCircleIcon style={{ color: "#d17504" }} />}
                              />
                            }
                            label={
                                <div className='qualitymenu__itemdiv' onClick={() => download360(item.qua)}>
                                  <span>
                                    <span className='qualitytype'>{item.qua}{item.tag}</span>
                                    <br />
                                    {item.desc}
                                  </span>
                                  {item.qua === 1080 && <Chip label="Plus" className='qualitymenu_chip' variant="outlined" />}
                                </div>
                            }
                          />
                        ))}
                      </RadioGroup> */}
                    </div>
                  </ClickAwayListener>
                </Paper>
              </Grow>
            )}
          </Popper>

          <div className="container-menu__project-name">
            {isProjectTitle ? (
              <input
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus
                type="text"
                value={item.title}
                onChange={updateTitle}
                onKeyDown={onEnterKeyPress}
                onBlur={() => setProjectTitle(false)}
              />
            ) : (
              <span onDoubleClick={() => setProjectTitle(true)}>
                {item.title || 'Untitled project'}
              </span>
            )}
            <SVGInline
              className="icon icon-button"
              classSuffix=""
              svg={editIcon}
              cleanup={['title']}
              component="button"
              onClick={() => setProjectTitle(!isProjectTitle)}
            />
          </div>


          <ExpandButton />
          <Menu
            toggleElement={<UserBox />}
            items={userItems}
            className="user-menu flex-center"
            needEndIcon
          />

        </Toolbar>

      </AppBar>
    </div>
  );
});

MenuAppBar.propTypes = {
  whiteLabelManager: PropTypes.shape({}),
};

export default MenuAppBar;
