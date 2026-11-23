import { Config } from '@remotion/cli/config';

Config.setBrowserExecutable('/opt/pw-browsers/chromium');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(4);
