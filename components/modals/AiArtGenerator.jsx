import React, { useCallback, useEffect, useMemo, useState, Fragment, useRef } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import AudioPlayer from 'react-audio-player';
import transparent from '../../public/static/AdvanceImageSvg/background.png';
import { ERROR_TEXT_SYMBOLS } from '../../lib/constants/text-info';
import { ASSET_TYPES } from '../../lib/constants/media';
import { saveAs } from 'file-saver';
import PropTypes from '../../lib/PropTypes';
import mediaConstants from '../../lib/constants/media';
import { reducer as voiceReducer, initialState as voiceInitialState } from '../../lib/utils/reducers/voiceReducer';
import {
    VOICES as UNLIMITED_VOICES,
    LANGUAGES as UNLIMITED_LANGUAGES,
    LIMITED_LANGUAGES,
    LIMITED_VOICES,
    ENGINE_TYPE_VALUES,
    maxSymbols,
} from '../../lib/constants/googleTextToSpeech';
import { addToken, wrapTokens, unwrapTokens } from '../../lib/utils/tokens-helper';
import { TOKEN_REGEX, tokenModes } from '../../lib/constants/tokens';
import { POPCORN_ELEMENT_TYPES } from '../../lib/constants/popcorn';
import { editorStyles } from '../../lib/constants/editorStyles';
// import config from '../../../config/config';
import useUIStore from '../hooks/useUIStore';
import useMediaStore from '../hooks/useMediaStore';
import useUserStore from '../hooks/useUserStore';
import useProjectStore from '../hooks/useProjectStore';
import useTimelineStore from '../hooks/useTimelineStore';
import FormSelect from '../form/FormSelect';
import { showError } from '../../lib/services/alertService';
import CloseButton from '../common/CloseButton';
// import { LibrarySpinner } from './Loader';
import PersonalizeButton from '../common/personalization/PersonalizeButton';
import FormTokensTextArea from '../form/FormTokensTextArea';
import FormTextArea from '../form/FormTextArea';
import FieldBuilder from '../form/FieldBuilder';
import TextToSpeechLibrary from '../common/textToSpeech/TextToSpeechLibrary';

import playIcon from '../../public/static/svgImages/voice/play-voice.svg';
import saveIcon from '../../public/static/svgImages/voice/save-voice.svg';
import textSpeechIcon from '../../public/static/images/gallary.svg';
import highLightIcon from '../../public/static/images/highlight.svg';
import { AI_ART_GENERATOR_MODAL } from '../../lib/constants/modals';

import arrowIcon from '../../public/static/svgImages/common/arrow-back.svg';
import { LIBRARY_KEYS, LIBRARY_TABS, tabItems } from '../../lib/constants/library';
import { ACTION_TYPES } from '../../lib/constants/reducers/voiceReducer';
import { Button, Popover, Tab, Tabs } from '@material-ui/core';
import { MEDIA_TYPES } from '../../lib/constants/popcorn';
import { useDropzone } from 'react-dropzone';
import { CircleLoader } from 'react-spinners';
import { LOADING_COLOR } from '../../lib/constants/ui';
import PercentageProgressBar from '../media/PercentageProgressBar';

const AiArtGenerator = observer(({ startUpload, options }) => {
    const { voiceTextId, setVoiceTextId, findElement, findAndUpdate, element, showWarning, addElement } = useProjectStore();
    const { toggleRightBlock, toggleVisibleCanvas, secondaryWindowType: activeTab, openSettings, setUpdateElementInLibrary } = useUIStore();
    const {
        getTemporaryGoogleTextToSpeech,
        saveTemporaryTextToSpeech,
        saveTextToSpeech,
        uploadImageUrl,
        storeAsset,
        uploadMedia,
    } = useMediaStore();
    const {
        getTextSpeechSymbols,
        textToSpeechNeuralEnabled,
        onlyLimitedTextToSpeech,
        textToSpeechSpeedEnabled,
        textToSpeechPitchEnabled,
    } = useUserStore();

    const onImageEdited = (image) => {
        findAndUpdate(element.id, { ...INITIAL_VALUES, src: image });
        closeModal(AI_ART_GENERATOR_MODAL);
    };

    const { timelineHeight } = useTimelineStore();

    const languages = React.useMemo(() => (onlyLimitedTextToSpeech ? LIMITED_LANGUAGES
        : UNLIMITED_LANGUAGES), [onlyLimitedTextToSpeech]);

    const userVoices = React.useMemo(() => (onlyLimitedTextToSpeech ? LIMITED_VOICES
        : UNLIMITED_VOICES), [onlyLimitedTextToSpeech]);



    const [valueTextarea, setValueTextarea] = useState('');
    const [htmlText, setHtmlText] = useState('');
    const [fallbackValue, setFallbackValue] = useState('');

    const [state, dispatch] = React.useReducer(voiceReducer, voiceInitialState);

    useEffect(() => {
        if (!state.init) {
            dispatch({
                type: ACTION_TYPES.INIT,
                value: {
                    language: languages[0].value,
                    voices: userVoices,
                    allowedPro: textToSpeechNeuralEnabled,
                    pitch: 0,
                    speakingRate: 1,
                },
            });
        }
    }, []);

    const imageResList = [
        { label: 'Low (5 credts)', value: { height: 512, width: 512 } },
        { label: 'Medium (8 credts)', value: { height: 1024, width: 1024 } },
        { label: 'High (12 credts)', value: { height: 1920, width: 1080 } },

    ];

    const [caret, setCaret] = useState();
    const [symbols, setSymbols] = useState();

    const [isPlaying, setIsPlaying] = useState(false);
    const [isActivePreview, setIsActivePreview] = useState(false);
    const [audioFile, setAudioFile] = useState(null);
    const [audio, setAudio] = useState(null);
    const [addedItems, setAddedItems] = useState([]);
    const [imageUploadedUrl, setImageUploadedUrl] = useState(null);
    const addFileInputRef = useRef();
    const [imageRes, setImageRes] = React.useState('');

    const handleChange = (v) => {
        const item = imageResList.find(languageItem => languageItem.value === v).value;
        console.log(item,"item")
        setImageHeight(item.height);
        setImageWidth(item.width);
        setImageRes(item);
    };

    useEffect(() => {
        if (voiceTextId && symbols) {
            let activeTextElement;

            if (typeof voiceTextId === 'object' && voiceTextId.id && voiceTextId.textId) {
                const element = findElement(voiceTextId.id);
                if (element.type === POPCORN_ELEMENT_TYPES.COMBINED) {
                    activeTextElement = element.popcornOptions.items.find(el => (
                        el.id === voiceTextId.textId
                    ));
                }
            } else {
                activeTextElement = findElement(voiceTextId).popcornOptions;
            }

            const isPersonalizedVoice = activeTextElement.text && activeTextElement.text.indexOf('{{') !== -1;
            const maxVoiceSymbols = maxCount(
                isPersonalizedVoice ? maxSymbols.personalized : maxSymbols.text,
            );
            const newTextLength = activeTextElement.text.replace(/{{\w+}}/g, '').length;
            let newText = activeTextElement.text.toLowerCase().replace(/<br>/g, '');

            if (isPersonalizedVoice) {
                const newString = newText.replace(TOKEN_REGEX, (match) => {
                    match = match.replace(/({{|}})/gm, '');
                    let result = '';
                    if (match.split(' ').length > 1) {
                        const [, tokenName] = match.split(' ');
                        result += `{{${tokenName.toUpperCase()}}}`;
                    } else {
                        result += `{{${match.toUpperCase()}}}`;
                    }
                    return result;
                });

                const rawArray = newString.split(' ');
                const textArray = [];

                rawArray.forEach(item => {
                    if (item.indexOf('{{') !== -1 || item.indexOf('}}') !== -1) {
                        const arrayStings = item.replace(TOKEN_REGEX, (match) => {
                            match = match.replace(/({{|}})/gm, '');
                            let result = '';
                            result += ` {{${match}}} `;
                            return result;
                        }).split(' ');

                        arrayStings.forEach(el => {
                            if (el) {
                                textArray.push(el);
                            }
                        });
                    } else {
                        textArray.push(item);
                    }
                });

                let lastItemIndex = 0;
                let mapTextLength = 0;
                let difference = 0;
                for (let i = 0; i < textArray.length; i++) {
                    if (textArray[i].indexOf('{{') === -1) {
                        mapTextLength += textArray[i].length + 1;
                        lastItemIndex = i;
                    } else {
                        mapTextLength += 1;
                    }
                    if (mapTextLength >= maxVoiceSymbols) {
                        difference = mapTextLength - maxVoiceSymbols;
                        break;
                    }
                }

                textArray[lastItemIndex] = textArray[lastItemIndex].slice(0,
                    textArray[lastItemIndex].length - difference);

                if (newTextLength > maxVoiceSymbols) {
                    const newArray = textArray.slice(0, lastItemIndex + 1);
                    newText = newArray.join(' ');
                } else {
                    newText = textArray.join(' ');
                }

                const isBracketsStart = newText.lastIndexOf('{{');
                const isBracketsEnd = newText.lastIndexOf('}}');
                if (isPersonalizedVoice && isBracketsStart > isBracketsEnd) {
                    newText = newText.slice(0, isBracketsStart - 1);
                }
            }

            if (newTextLength > maxVoiceSymbols && !isPersonalizedVoice) {
                newText = newText.slice(0, maxVoiceSymbols);
            }


            setValueTextarea(newText);
            setHtmlText(wrapTokens(newText));
            setVoiceTextId(null);
        }
    }, [voiceTextId, symbols]);

    const onDrop = (acceptedFiles) => {
        const wrongFormat = [];
        const wrongSize = [];
        const files = [];

        if (addFileInputRef.current) {
            addFileInputRef.current.value = '';
        }

        acceptedFiles.forEach((file) => {
            const validFormat = Object.keys(tabItems).some((item) => tabItems[item].formats.some(
                (format) => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0],
            ),
            );

            const isImage = tabItems[LIBRARY_TABS.IMAGE].formats.some(
                (format) => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0],
            );
            const isVideo = tabItems[LIBRARY_TABS.VIDEO].formats.some(
                (format) => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0],
            );
            const isAudio = tabItems[LIBRARY_TABS.AUDIO].formats.some(
                (format) => format === file.name.match(/\.[0-9a-z]{1,5}$/)[0],
            );

            // if (!validFormat) {
            //     wrongFormat.push(file);
            // } else if (isImage) {
            //     if (config.image.maxSize < file.size) {
            //         wrongSize.push(file);
            //     } else {
            //         files.push(file);
            //     }
            // } else if (isVideo) {
            //     if (config.video.maxSize < file.size) {
            //         wrongSize.push(file);
            //     } else {
            //         files.push(file);
            //     }
            // } else if (isAudio) {
            //     files.push(file);
            // }
            files.push(file);
        });
        const errorFilesText = (errorFiles, text) => `
        Invalid file ${errorFiles.length > 1 ? `${text}s` : `${text}`} with ${errorFiles.length > 1 ? 'names' : 'name'
            }:
          ${errorFiles.map((file) => ` ${file.name}`)}. \\n`;

        const invalidFormatMessage = `${errorFilesText(wrongFormat, 'format')}
          Supported Formats:
          Video: ${tabItems[LIBRARY_TABS.VIDEO].formats.map(
            (format) => ` ${format}`,
        )}.
          Image: ${tabItems[LIBRARY_TABS.IMAGE].formats.map(
            (format) => ` ${format}`,
        )}.
          Audio: ${tabItems[LIBRARY_TABS.AUDIO].formats.map(
            (format) => ` ${format}`,
        )}.
        `;

        // const invalidSizeMessage = `${errorFilesText(wrongSize, 'size')}
        //   Supported Size:
        //   Image: ${config.image.maxSize / 1024 / 1024} mb.
        //   Video: ${config.video.maxSize / 1024 / 1024} mb.`;

        // if (wrongFormat.length) {
        //     showError(invalidFormatMessage);
        // } else if (wrongSize.length) {
        //     showError(invalidSizeMessage);
        // }

        const elements = [];
        const elementsIds = [];

        if (files.length) {
            // setIsDisabledUpload(true);
            Promise.all(
                files.map(async (data) => {
                    const asset = await uploadMedia({ data });

                    const fileExtension = asset.url.match(/\.[0-9a-z]{1,5}$/)[0];
                    let fileType = activeTab;
                    Object.keys(tabItems).forEach((item) => {
                        tabItems[item].formats.forEach((format) => {
                            if (format === fileExtension) {
                                fileType = item;
                            }
                        });
                    });
                    if (asset.url) {
                        setImageUploadedUrl(asset.url);
                    }
                    // const item = await storeAsset(asset, fileType);
                    // elements.push(item);
                    // elementsIds.push(item._id);
                    // return fileExtension;
                }),
            )
                .then((fileExtension) => {
                    // const extension = fileExtension[fileExtension.length - 1];

                    // Object.keys(tabItems).forEach((item, i) => {
                    //     tabItems[item].formats.forEach((format) => {
                    //         if (format === extension) {
                    //             setActiveTab(Object.keys(tabItems)[i]);
                    //         } else {
                    //             setItems([...elements, ...items]);
                    //             setUploadedItems([...uploadedItems, ...elementsIds]);
                    //         }
                    //     });
                    // });
                })
                .catch((err) => {
                    showError(err.message);
                })
                .finally();
        }
    };


    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: mediaConstants.ACCEPTED_MEDIA_TYPES,
        onDrop,
        disabled: false,
    });

    const onSelect = async (item) => {
        if (isLoading) {
            return;
        }
        console.log(activeTab, "actveTab", item)
        item.src = item.src || item.url;
        item.is360 = false;
        item.type = 'image';
        item.kind = 'image';
        // if (activeTab === LIBRARY_TABS.VOICE) {
        //     item.type = MEDIA_TYPES.AUDIO;
        // } else {
        //     item.type = MEDIA_TYPES[activeTab];
        // }

        if (item.kind === ASSET_TYPES.PERSONALIZED_VOICE) {
            showWarning(TEXT_TO_SPEECH_WARNING.title);
        }

        if (activeTab === LIBRARY_TABS.IMAGE) {
            findAndUpdate(updateElementInLibrary, item);
            openSettings();
            setUpdateElementInLibrary();
        } else {
            setIsLoading(true);
            //   setIsInitialLoading(true);
            try {
                // const imageKeys = [LIBRARY_KEYS.PEXELS, LIBRARY_KEYS.PIXABAY];
                // if (activeTab === LIBRARY_TABS.IMAGE && imageKeys.includes(activeBtn)) {
                //     item = await uploadImageUrl(item);
                // }
                console.log("clll here")
                await addElement(item);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
                openSettings();
                toggleVisibleCanvas(true);
                // setIsInitialLoading(false);
                // clearAllSelectedItems()
            }
        }
    };




    const quantify = () => {
        userCutOutProBalance()
            .catch(() => showError(ERROR_CUTOUTPRO_TEXT_SYMBOLS.title));
    };

    useEffect(() => quantify(), []);

    const closeWindow = () => {
        toggleRightBlock(false);
        toggleVisibleCanvas(true);
    };





    const libraryHeight = useMemo(() => (
        editorStyles.calculateHeight(timelineHeight)
    ), [timelineHeight]);
    const [description, setDescription] = useState(null);
    const [newImage, setNewImage] = useState(null);
    const [activeButton, setActiveButton] = useState('character');
    const [active, setActive] = useState(null);
    const [style, setStyle] = useState(null);
    const [size, setSize] = useState(null);
    const [isProcessImage, setIsProcessImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const userStore = useUserStore();
    const [imageHeight, setImageHeight] = useState(1024);
    const [imageWidth, setImageWidth] = useState(1024);
    const [error, setError] = useState(null)
    const [inspiration, setInspiration] = useState('celebraties')
    const [activeOpt, setActiveOpt] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    const {
        updateUserCreditUseAndGetUserCreditBalance,
        userCutOutProBalance,
        cutoutProCreditUserUsed,
        cutoutProCreditAvailableBalance,
    } = userStore;
    const sizeHandler = (event, newValue) => {
        setSize(newValue);
    }

    const downloadImage = () => {
        saveAs(newImage, 'image.png');
    };

    const celebratiesArr = [
        "Elon Musk",
        "Cristiano Ronaldo",
        "Barak Obama",
        "Lionel Messi",
        "Kim Kardashian",
        "LeBron James",
        "Taylor Swift",
        "Neymar",
        "George Clooney",
        "Dwayne Johnson",
        "Johnny Depp",
        "Will Smith",
        "Beyoncé",
        "Billie Eilish",
        "DrakeElon Musk",
        "Cristiano Ronaldo",
        "Barak Obama",
        "Lionel Messi",
        "Kim Kardashian",
        "LeBron James",
        "Taylor Swift",
        "Drake",
        "Howard Stern",
        "Chris Evans",
        "Britney Spears",
        "Morgan Freeman",
        "Lady Gaga",
        "Sandra Bullock",
        "Jennifer Lopez",
        "Snoop Dogg",
        "Angelina Jolie",
        "Kylie Jenner",
        "Jim Carrey",
        "Emma Watson",
        "Justin Bieber",
        "Kamala Harris",
        "Adele",
        "Travis Scott",
        "Zendaya",
        "Nicki Minaj",
        "Rihanna",
        "Tom Holland",
        "Camila Cabello",
        "Jungkook",
        "Demi Lovato",
    ]
    const characterArr = [
        "A beautiful young woman",
        "Young man with short, ash blond hair",
        "A elegant necromancer girl",
        "African steampunk alchemist",
        "Male wizard with glowing eyes",
        "Portrait of a beautiful fit elf ranger",
        "Japanese girls wear fantasy yukata in festival",
        "Portrait of a Opal-haired goddess",
        "Dreamlike luxury stunning gothic young female",
        "Rusting tape machine robot",
        "A cyborg pilot in the cockpit of a battle droid",
        "Respectable dignified middle aged amish preacher",
        "Portrait of a proud aztec moon goddess",
        "Stylish woman wearing a black loose fit suit with a tie",
        "Young female black military uniform maid with a beret",
        "Portrait of dark muscular indian royal couple",
        "A young ruggedly handsome pirate",
        "A portrait of the handsome bearded king",
        "Amazon valkyrie Athena",
        "Female tennis player",
    ]
    const scenarioArr = [
        "An opulent marketplace street scene",
        "National Geographic landscape",
        "Futuristic utopian metropolis",
        "Inside an old magical sweet shop",
        "Atlantis, palaces underwater",
        "Beautiful hobbit house by the lake",
        "The apartment room in a cyberpunk city",
        "Chubby futuristic shop in the desert",
        "A demonic magical ethereal portal",
        "A shopping street in the Chinese imperial city",
        "An igloo in the tundra, with a campfire near the entrance",
        "Star fleet nautilus ship being prepared for launch",
        "Futuristic cyberpunk robot city",
        "A neoclassical city suspended with huge steel constructions",
        "A flourishing roman city"
    ]

    useEffect(() => {
        if (size == 'onebyone') {
            setImageHeight(512);
            setImageWidth(512);
        }
        if (size == 'threebyfour') {
            setImageHeight(1027);
            setImageWidth(768);
        }
        if (size == 'ninebysixteen') {
            setImageHeight(810);
            setImageWidth(540);
        }
        if (size == 'onebytwo') {
            setImageHeight(1024);
            setImageWidth(512);
        }
        if (size == 'fourbythree') {
            setImageHeight(1027);
            setImageWidth(768);
        }
        if (size == 'sixteenbynine') {
            setImageHeight(810);
            setImageWidth(540);
        }
    }, [size])

    const processAIImage = async (val) => {
        let credit = 5;
        if (imageRes.width == 1024 && imageRes.height == 1024) {
            credit = 8;
        }
        if (imageRes.width == 1920 && imageRes.height == 1080) {
            credit = 14;
        }
        const total = cutoutProCreditUserUsed + credit;

        await fetch(`https://www.cutout.pro/api/v1/getText2imageResult?taskId=${val}`, {
            method: 'get',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Accept: 'application/json',
                APIKEY: 'f8215a0e6b3b40b78a2ce62ce89c5d9e',
            },
        }).then((data) =>
            data.json(),
        ).then(async resp => {
            if (resp?.code == 9010) {
                setIsLoading(false);
                setError('The description information has failed the review and contains illegal content')
            }
            if (resp.data.status == 3 || resp.data.status == 0) {
                // setProgressState(100 - resp.data.waitNumber)
                processAIImage(val)
            }
            if (resp.data.status == 1) {
                setIsLoading(false);
                setIsProcessImage(true);
                // setProgressState(0);
                setNewImage(resp.data.resultUrl);
                updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
            }
        })
            .catch((error) => {
                console.log(error, "errrr")
                setIsLoading(false);
                showError('Something went wrong. Please try again later.');
            });
    }

    const onLoadImage = useCallback(async (image) => {
        // const base64Response = await fetch(`data:image/jpeg;base64,${image}`);
        // const blob = await base64Response.blob();

        if (!newImage) {
            return;
        }

        let media;
        let hasError;

        try {
            setIsLoading(true);
            const data = {
                url: image
            }
            media = await uploadImageUrl(data);
            const fileExtension = media.url.match(/\.[0-9a-z]{1,5}$/)[0];
            let fileType = activeTab;
            Object.keys(tabItems).forEach((item) => {
                tabItems[item].formats.forEach((format) => {
                    if (format === fileExtension) {
                        fileType = item;
                    }
                });
            });
            const imgItems = await storeAsset(media, fileType);
            await onSelect(imgItems);
        } catch (e) {
            hasError = true;
            showError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [newImage]);

    const processImage = async () => {
        setIsLoading(true);
        // const total = cutoutProCreditUserUsed + 2;
        const data = {
            prompt: description,
            ...(imageWidth && { width: imageWidth }),
            ...(imageHeight && { height: imageHeight }),
            ...(style && { style: style }),
            ...(imageUploadedUrl && { imageUrl: imageUploadedUrl }),
        }
        fetch(`https://www.cutout.pro/api/v1/text2imageAsync`, {
            method: 'post',
            body: JSON.stringify(data),
            headers: {
                'Content-type': 'application/json',
                Accept: 'application/json',
                APIKEY: 'f8215a0e6b3b40b78a2ce62ce89c5d9e',
            },
        })
            .then((data) =>
                // eslint-disable-next-line implicit-arrow-linebreak
                data.json(),
            ).then(resp => {

                setIsProcessImage(true);

                if (resp.msg === 'Processing failed') {
                    setError(resp.msg);
                } else {
                    processAIImage(resp.data);
                    setError(null);
                    // talk to backend to reduce the use cutoutpro credit
                    // updateUserCreditUseAndGetUserCreditBalance({ cutOutProCredit: total });
                }
            })
            // eslint-disable-next-line no-unused-vars
            .catch((error) => {
                console.log(error, "errr")
                setIsLoading(false);
                showError('Something went wrong. Please try again later.');
            });
    };

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleTooltipClose = () => {
        setAnchorEl(null);
    };


    const onChange = (event) => {
        const { value } = event.target;
        setDescription(value);
    };

    const characterArray = [
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/1-small.png', name: "Photographic" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/2-small.png', name: "Oil Painting" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/3-small.png', name: "J-Manga" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/4-small.png', name: "Elf" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/5-small.png', name: "Princess" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/6-small.png', name: "LoL" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/7-small.png', name: "Realistic Anime" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/8-small.png', name: "Matte Painting" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/9-small.png', name: "Dragon Horns" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/10-small.png', name: "Glowing Forest" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/11-small.png', name: "Office Lady" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/12-small.png', name: "Suit Thug" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/13-small.png', name: "Vector Art" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/14-small.png', name: "West Coast" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/15-small.png', name: "Blue Rhapsody" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/16-small.png', name: "Graffiti" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/17-small.png', name: "Clown" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/18-small.png', name: "Flat Comic" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/19-small.png', name: "R&M" },
        { img: 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/20-small.png', name: "Shooter" },
        // 'https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/chara/1-small.png'

    ]
    const scenarioStyle = [
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/1-small.png", name: "Realistic" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/2-small.png", name: "Concept Art" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/3-small.png", name: "Illustration" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/4-small.png", name: "Cartoon Store" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/5-small.png", name: "3D Game" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/6-small.png", name: "3D Room" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/7-small.png", name: "Poly" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/8-small.png", name: "Interior" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/9-small.png", name: "Ghibli" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/10-small.png", name: "Coffee Shop" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/11-small.png", name: "Sci-Fi" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/12-small.png", name: "Mechanical" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/13-small.png", name: "Starship" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/14-small.png", name: "Utopia" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/15-small.png", name: "Battle" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/16-small.png", name: "Cyber Room" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/17-small.png", name: "Adventure" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/18-small.png", name: "Chinese Style" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/19-small.png", name: "Fantasia" },
        { img: "https://d38b044pevnwc9.cloudfront.net/cutout-nuxt/art/border/scene/20-small.png", name: "Blue Flame" },


    ]
    const base64 = `data:image/png;base64,${newImage}`;
    const open = Boolean(anchorEl);
    const id = open ? 'simple-popover' : undefined;
    return (
        <div style={{ height: libraryHeight }} className="text-to-speech">
            <div className="ai-art-generator__body">
                <div className='ai-art-generator__header'>
                    <p className='mt-2'>AI Art Generator</p>
                    <p>
                        User available Credit
                        {' '}

                        {cutoutProCreditAvailableBalance <= 0 ? (
                            <span style={{ color: 'red' }}>
                                0
                            </span>
                        ) : (
                            <span style={{ color: 'red' }}>
                                {' '}
                                {`${cutoutProCreditAvailableBalance}`}
                                {' '}
                            </span>
                        )}
                    </p>
                </div>
                <div className='ai-art-generator__content'>
                    <div className='ai-art-generator__content-first'>
                        <div>
                            <div>
                                <textarea
                                    rows={10}
                                    // {...getRootProps()}
                                    className="text-input full-width-container"
                                    value={description}
                                    // onKeyPress={onKeyPress}
                                    onChange={onChange}
                                // placeholder={placeholder}
                                />
                                <button onClick={handleClick}>
                                    <SVGInline
                                        svg={highLightIcon}
                                        cleanup={['title']}
                                    />
                                    Inspiration
                                </button>
                                <Popover
                                    id={id}
                                    open={open}
                                    anchorEl={anchorEl}
                                    onClose={handleTooltipClose}
                                    anchorOrigin={{
                                        vertical: 'bottom',
                                        horizontal: 'center',
                                    }}

                                    className='toolip-root'
                                    transformOrigin={{
                                        vertical: 'top',
                                        horizontal: 'center',
                                    }}
                                >
                                    <div style={{ backgroundColor: "#1C1C26", border: 'solid 1px #ef5054', padding: '5px', borderRadius: '5px' }}>
                                        <p style={{ fontSize: '16px', fontWeight: '600px', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>Inspiration</p>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginBottom: '5px' }}>
                                            <Button style={{ fontSize: '12px', backgroundColor: "#EB5054", color: '#fff' }} onClick={() => {
                                                setInspiration('celebraties')
                                                setActiveOpt(0)
                                            }}>Celebrities</Button>
                                            <Button style={{ fontSize: '12px', backgroundColor: "#EB5054", color: '#fff' }} onClick={() => {
                                                setInspiration('character')
                                                setActiveOpt(0)
                                            }}>Character</Button>
                                            <Button style={{ fontSize: '12px', backgroundColor: "#EB5054", color: '#fff' }} onClick={() => {
                                                setInspiration('scenario')
                                                setActiveOpt(0)
                                            }}>Scenario</Button>
                                        </div>
                                        <div style={{ height: "200px", overflow: 'auto', textAlign: 'center' }}>
                                            {inspiration == 'celebraties' && celebratiesArr.map(((ele, index) => (
                                                <div style={{ cursor: 'pointer', padding: "5px 0px" }} className={`${index == activeOpt ? 'active-style-senario' : ''}`} onClick={() => {
                                                    setDescription(ele)
                                                    setActiveOpt(index)
                                                }}>
                                                    <p style={{ color: '#fff', fontSize: '12px', whiteSpace: 'nowrap', width: 300, textOverflow: 'ellipsis', overflow: 'hidden' }}>{ele}</p>
                                                </div>
                                            )))
                                            }

                                            {inspiration == 'character' && characterArr.map(((ele, index) => (
                                                <div style={{ cursor: 'pointer', padding: "5px 0px" }} className={`${index == activeOpt ? 'active-style-senario' : ''}`} onClick={() => {
                                                    setDescription(ele)
                                                    setActiveOpt(index)
                                                }}>
                                                    <p style={{ color: '#fff', fontSize: '12px', whiteSpace: 'nowrap', width: 300, textOverflow: 'ellipsis', overflow: 'hidden' }}>{ele}</p>
                                                </div>
                                            )))
                                            }

                                            {inspiration == 'scenario' && scenarioArr.map(((ele, index) => (
                                                <div style={{ cursor: 'pointer', padding: "5px 0px" }} className={`${index == activeOpt ? 'active-style-senario' : ''}`} onClick={() => {
                                                    setDescription(ele)
                                                    setActiveOpt(index)
                                                }}>
                                                    <p style={{ color: '#fff', fontSize: '12px', whiteSpace: 'nowrap', width: 300, textOverflow: 'ellipsis', overflow: 'hidden' }}>{ele}</p>
                                                </div>
                                            )))
                                            }
                                        </div>
                                    </div>
                                </Popover>
                                <div   {...getRootProps()} style={{ backgroundColor: '#000', cursor: 'pointer' }}>
                                    <input {...getInputProps()} />
                                    <p>Reference <span>(Optional)</span></p>
                                    {!imageUploadedUrl && <SVGInline
                                        svg={textSpeechIcon}
                                        cleanup={['title']}
                                    />}
                                    {imageUploadedUrl &&
                                        <img width={'80px'} height={'80px'} src={imageUploadedUrl} />
                                    }
                                </div>
                            </div>
                            <div>
                                <button onClick={() => setActiveButton('character')} className={activeButton === 'character' ? 'active' : ''}>Character Style</button>
                                <button onClick={() => setActiveButton('scenario')} className={activeButton === 'scenario' ? 'active' : ''}>Scenario Style</button>
                            </div>
                            <div>
                                {activeButton == 'character' && characterArray.length && characterArray.map((ele, index) => (
                                    <div onClick={() => {
                                        setStyle(ele?.name)
                                        setActive(index)
                                    }}>
                                        <img src={ele?.img} className={`${index == active ? 'active-style' : ''}`} />
                                        <p style={{ fontSize: '11px' }}>{ele?.name}</p>
                                    </div>
                                ))
                                }
                                {activeButton == 'scenario' && scenarioStyle.length && scenarioStyle.map((ele, index) => (
                                    <div onClick={() => {
                                        setStyle(ele?.name)
                                        setActive(index)
                                    }}>
                                        <img src={ele?.img} className={`${index == active ? 'active-style' : ''}`} />
                                        <p style={{ fontSize: '11px' }}>{ele?.name}</p>
                                    </div>
                                ))
                                }
                            </div>

                            {<div><button disabled={isLoading} onClick={() => processImage()}>Generate Image</button>
                                <FormSelect
                                    items={imageResList}
                                    className="text-to-speech__select"
                                    value={imageRes}
                                    onChange={handleChange}
                                /></div>
                            }
                        </div>
                        <div>
                            <p className='text-center'>Size</p>
                            <Tabs
                                value={size}
                                onChange={sizeHandler}
                                aria-label="wrapped label tabs example"
                            >
                                <Tab value={'onebyone'} label={<><div style={{ backgroundColor: "#fff", height: "25px", width: "25px", textAlign: "center", color: '#000' }}></div><p>1:1</p></>} />
                                <Tab value={'threebyfour'} label={<><div style={{ backgroundColor: "#fff", height: "41px", width: "27px", textAlign: "center", color: '#000' }}></div><p>3:4</p></>} />
                                <Tab value={'ninebysixteen'} label={<><div style={{ backgroundColor: "#fff", height: "47px", width: "25px", textAlign: "center", color: '#000' }}></div><p>9:16</p></>} />
                                <Tab value={'onebytwo'} label={<><div style={{ backgroundColor: "#fff", height: "53px", width: "21px", textAlign: "center", color: '#000' }}></div><p>1:2</p></>} />
                                <Tab value={'fourbythree'} label={<><div style={{ backgroundColor: "#fff", height: "27px", width: "41px", textAlign: "center", color: '#000' }}></div><p>4:3</p></>} />
                                <Tab value={'sixteenbynine'} label={<><div style={{ backgroundColor: "#fff", height: "25px", width: "47px", textAlign: "center", color: '#000' }}></div><p>16:9</p></>} />
                            </Tabs>
                        </div>
                    </div>
                    <div className='ai-art-generator__content-second'>
                        {isProcessImage && <h1>AI Image Generator Results</h1>}
                        {isProcessImage && <hr />}
                        {isProcessImage && <p>Generate an image of the Sci-fi scene set in future world.</p>}
                        {!isProcessImage && !isLoading && <p>No Image Generated. Please Generate Image Using Prompt to check the Results.</p>}
                        {isLoading &&
                            <>
                                <p>Please be patient while Videoremix AI does its Magic</p>
                                <div className="progressState" style={{ width: "500px", marginTop: 0 }}>
                                    <PercentageProgressBar />
                                </div></>}
                        {isLoading == false ?
                            isProcessImage ? (
                                <img
                                    src={newImage}
                                />
                            ) :
                                <img src={transparent} /> : null

                        }

                        {isProcessImage && !isLoading && <button onClick={() => downloadImage()} style={{ backgroundColor: '#eb5054', border: 0 }}>Download Image</button>

                        }
                        {isProcessImage && !isLoading && <button onClick={() => onLoadImage(newImage)} style={{ backgroundColor: 'transparent', border: "1px solid #575773" }}>Save to Canvas</button>

                        }
                    </div>
                </div>


                {/* <p className="text-to-speech__information">You can use 70 characters to personalize voice or 150 characters for voice without personalization.</p> */}

                {/* {warningMessage && <p className="text-to-speech__warning">{warningMessage}</p>} */}

                {/* <div className="text-to-speech__footer">
           

            <div className="text-to-speech__buttons">
              <PersonalizeButton
                onAdd={onAddTextToken}
                text="Personalize Voice"
                disabled={disabledPersonalizedVoice}
                elementType={ASSET_TYPES.PERSONALIZED_VOICE}
                tokenModes={{
                  plain: tokenModes.plain,
                }}
              />
              <button
                onClick={existedAudio ? playVoice : getVoice}
                className={classnames('btn-speech-get', { 'btn-speech-get-disabled': isDisabledButton || loading })}
                disabled={isDisabledButton}
              >
                {loading && !existedAudioFile ? <LibrarySpinner /> : (
                  <SVGInline
                    svg={playIcon}
                    cleanup={['title']}
                  />
                )}
              </button>
              {existedAudioFile ? (
                <button
                  onClick={saveVoice}
                  className={classnames('btn-speech-get', { 'btn-speech-get-disabled': loading })}
                >
                  {loading ? <LibrarySpinner /> : (
                    <SVGInline
                      svg={saveIcon}
                      cleanup={['title']}
                    />
                  )}
                </button>
              ) : null}
            </div>
          </div> */}
                {/* </div> */}
                {/* 
        <div className={classnames('text-to-speech__slider', { 'text-to-speech__slider-enum': !textToSpeechNeuralEnabled })}>
          <button className="text-to-speech__slider-left" onClick={() => sliderClick(true)}>
            <SVGInline
              svg={arrowIcon}
              cleanup={['title']}
            />
          </button>
          <button className="text-to-speech__slider-right" onClick={() => sliderClick()}>
            <SVGInline
              svg={arrowIcon}
              cleanup={['title']}
            />
          </button>
          <p className="text-to-speech__voice-name">{state.voice.label}</p>
          <div className="text-to-speech__image">
            <img src={currentVoiceImage} alt="img" />
          </div>
          {isDisplayingControls && (
            <div className="text-to-speech__controls">
              <button
                className={classnames('text-to-speech__button', { 'text-to-speech__button-active': isPlaying })}
                onClick={changePlaying}
              />
              {isActivePreview && (
                <AudioPlayer
                  src={state.preview}
                  onEnded={() => changePlaying(false)}
                  autoPlay
                />
              )}
            </div>
          )}
        </div> */}

                {/* <TextToSpeechLibrary
          addedItems={addedItems}
          setAddedItems={setAddedItems}
          kind={lastKind}
        /> */}
            </div>
            <CloseButton className="close-button-extend" onClick={closeWindow} />
        </div>
    );
});

AiArtGenerator.propTypes = {
    className: PropTypes.string,
    imageData: PropTypes.shape({
        source: PropTypes.string,
        width: PropTypes.number,
        height: PropTypes.number,
    }).isRequired,
    onImageEdited: PropTypes.func.isRequired,
    startUpload: PropTypes.func.isRequired,
    endUpload: PropTypes.func.isRequired,
    noCrop: PropTypes.bool.isRequired,
};
AiArtGenerator.defaultProps = {
    noCrop: false,
};

export default AiArtGenerator;