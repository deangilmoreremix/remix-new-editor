import * as React from 'react';
import Campaign from '../campaigns/Campaign';

const mockProject = {
  _id: '5a9028a5948883000fd8fc22',
  data: {
    targets: [{ id: 'Target0', name: 'video-container', element: 'video-container' }],
    media: [
      {
        id: 'Media0',
        name: 'Media0',
        url: '#t=,225.352',
        target: 'video',
        duration: 225.352,
        popcornOptions: { frameAnimation: true, framerate: 120 },
        controls: true,
        tracks: [
          {
            name: '',
            id: '5',
            order: 0,
            trackEvents: [
              {
                id: '4.320989834994168',
                type: 'image',
                popcornOptions: {
                  start: 0,
                  end: 225.09,
                  target: 'video-container',
                  src: 'https://www.planwallpaper.com/static/images/Winter-Tiger-Wild-Cat-Images.jpg',
                  linkSrc: '',
                  tags: '',
                  photosetId: '',
                  count: 3,
                  width: 100,
                  height: 100,
                  top: 0,
                  left: 0,
                  innerTop: 0,
                  innerLeft: 0,
                  innerWidth: 0,
                  innerHeight: 0,
                  title: '',
                  transition: 'popcorn-fade',
                  rotation: 0,
                  zindex: 1000,
                  scripts: '',
                  id: '4.320989834994168',
                },
                track: '5',
                name: '4.320989834994168',
              },
            ],
          },
          {
            name: '',
            id: '4',
            order: 1,
            trackEvents: [
              {
                id: '2.027597876439497',
                type: 'sequencer',
                popcornOptions: {
                  source: 'https://soundcloud.com/bigbabydram/broccoli',
                  fallback: '',
                  denied: false,
                  start: 0,
                  end: 225.352,
                  type: 'SoundCloud',
                  thumbnailSrc: 'https://i1.sndcdn.com/artworks-000156896947-3ch8k2-large.jpg',
                  from: 0,
                  title: 'BROCCOLI feat. Lil Yachty (Prod By. J Gramm)',
                  duration: 225.352,
                  linkback: '',
                  contentType: '',
                  hidden: true,
                  target: 'video-container',
                  mobile: true,
                  width: 100,
                  height: 100,
                  top: 0,
                  left: 0,
                  volume: 100,
                  mute: false,
                  zindex: 999,
                  scripts: '',
                  id: '2.027597876439497',
                },
                track: '4',
                name: '2.027597876439497',
              },
            ],
          },
        ],
        clipData: {
          'vr360://https://player.vimeo.com/external/255842510.hd.mp4?s=b93630ec17b8937cfe81ecbb398a8365609b3034&profile_id=174': {
            source: 'vr360://https://player.vimeo.com/external/255842510.hd.mp4?s=b93630ec17b8937cfe81ecbb398a8365609b3034&profile_id=174',
            type: 'Video360',
            title: '255842510.hd.mp4?s=b93630ec17b8937cfe81ecbb398a8365609b3034&profile_id=174',
            duration: 63.081667,
          },
          'https://soundcloud.com/bigbabydram/broccoli': {
            source: 'https://soundcloud.com/bigbabydram/broccoli',
            type: 'SoundCloud',
            thumbnail: 'https://i1.sndcdn.com/artworks-000156896947-3ch8k2-large.jpg',
            duration: 225.352,
            title: 'BROCCOLI feat. Lil Yachty (Prod By. J Gramm)',
            hidden: true,
          },
        },
        currentTime: 0,
      },
    ],
    allowFacebook: true,
    thumbnailWidth: 100,
    thumbnailHeight: 100,
    user: '5a90148646ee70000ff17bda',
    name: 'Test Vimeo 360',
    description: '',
    originalButterVersion: '2.1.41',
    latestButterVersion: '2.1.41',
    thumbnail: 'https://i1.sndcdn.com/artworks-000156896947-3ch8k2-large.jpg',
    background: '#FFFFFF',
    __v: 0,
    make: '5a9028a630846b00146ca7b3',
    allowedSocials: [
      'facebook',
    ],
  },
};

export default () => (
  <Campaign
    project={mockProject}
    onCampaignFinished={() => console.log('Çampaign finished')}
  />
);
