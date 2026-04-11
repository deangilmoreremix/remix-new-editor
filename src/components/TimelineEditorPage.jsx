import * as React from 'react';
import { observer } from 'mobx-react';
import { Provider } from 'mobx-react';
import VideoTransitionSettings from '../../components/settings/video-transition-settings/VideoTransitionSettings';
import OverlayListTransitions from '../../components/media/OverlayListTransitions';

export const TimelineEditorPage = observer(() => {
  // State for timeline editor
  const [selectedTransitionElement, setSelectedTransitionElement] = React.useState(null);
  const [timelineState, setTimelineState] = React.useState({
    tracks: [
      { id: 'video-1', name: 'Video', muted: false, solo: false, locked: true, clips: [
        { id: 1, name: 'Opening Shot', left: 8, width: 18, type: 'video' },
        { id: 'transition-1', name: 'Fade Transition', left: 26, width: 8, type: 'transition', transitionType: 'fade',
          fromClip: 1, toClip: 2, start: 10, end: 12, fromUrl: '', toUrl: '' },
        { id: 2, name: 'Generated Clip', left: 34, width: 16, type: 'video' }
      ] },
      { id: 'audio-1', name: 'Audio', muted: false, solo: false, locked: false, clips: [
        { id: 3, name: 'Music Bed', left: 5, width: 42, type: 'audio' }
      ] },
      { id: 'text-1', name: 'Text', muted: false, solo: false, locked: false, clips: [
        { id: 4, name: 'Title Card', left: 14, width: 12, type: 'text' }
      ] },
      { id: 'broll-1', name: 'B-Roll', muted: false, solo: false, locked: false, clips: [
        { id: 5, name: 'City Cutaway', left: 52, width: 20, type: 'broll' }
      ] }
    ],
    transitions: [{
      id: 'transition-1',
      fromClip: 1,
      toClip: 2,
      type: 'fade',
      duration: 2,
      start: 10
    }]
  });

  const [playheadPercent, setPlayheadPercent] = React.useState(32);
  const [selectedTool, setSelectedTool] = React.useState('Select');
  const [overlayTransitions, setOverlayTransitions] = React.useState([
    {
      id: 'overlay-1',
      name: 'Fade Transition',
      type: 'fade',
      duration: 2,
      thumbnail: 'fade.jpg'
    },
    {
      id: 'overlay-2',
      name: 'Wipe Transition',
      type: 'wipe',
      duration: 1.5,
      thumbnail: 'wipe.jpg'
    }
  ]);
  const [selectedClips, setSelectedClips] = React.useState([]);

  // Handler for overlay transition selection
  const handleTransitionSelect = React.useCallback((transition) => {
    // Find adjacent clips to apply transition between
    const videoTrack = timelineState.tracks.find(track => track.name === 'Video');
    if (!videoTrack || videoTrack.clips.length < 2) return;

    // For demo, apply between first two clips
    const clip1 = videoTrack.clips[0];
    const clip2 = videoTrack.clips[1];

    // Calculate transition position between clips
    const transitionStart = clip1.left + clip1.width;
    const transitionWidth = (transition.duration / 60) * 100; // Assuming 60fps, convert to percentage

    const newTransition = {
      id: `transition-${Date.now()}`,
      name: transition.name,
      left: transitionStart,
      width: transitionWidth,
      type: 'transition',
      transitionType: transition.type,
      fromClip: clip1.id,
      toClip: clip2.id,
      start: transitionStart,
      end: transitionStart + transitionWidth,
      fromUrl: '',
      toUrl: '',
      overlayId: transition.id
    };

    // Add transition to timeline
    setTimelineState(prev => ({
      ...prev,
      tracks: prev.tracks.map(track =>
        track.id === videoTrack.id
          ? { ...track, clips: [...track.clips, newTransition] }
          : track
      ),
      transitions: [...prev.transitions, {
        id: newTransition.id,
        fromClip: clip1.id,
        toClip: clip2.id,
        type: transition.type,
        duration: transition.duration,
        start: transitionStart
      }]
    }));
  }, [timelineState.tracks]);

  // Mock functions for VideoTransitionSettings props
  const mockUpdate = React.useCallback((options) => {
    console.log('Updating transition element:', options);
    // Update timeline state with transition
    setTimelineState(prev => ({
      ...prev,
      transitions: prev.transitions.map(t =>
        t.id === selectedTransitionElement?.id ? { ...t, ...options } : t
      )
    }));
  }, [selectedTransitionElement]);

  const mockFind = React.useCallback((id) => {
    // Find element in timeline state
    return timelineState.tracks.flatMap(track => track.clips).find(clip => clip.id === id);
  }, [timelineState.tracks]);

  const mockFields = {
    KIND: {
      name: 'kind',
      label: 'Transition Type',
      type: 'select',
      options: [
        { value: 'fade', label: 'Fade' },
        { value: 'wipe', label: 'Wipe' },
        { value: 'slide', label: 'Slide' },
        { value: 'dissolve', label: 'Dissolve' }
      ]
    }
  };

  // Mock stores for OverlayListTransitions
  const mockStores = {
    makeStore: {
      getJsonTransitions: async () => overlayTransitions.map(t => ({
        project: { data: JSON.stringify({ media: [{ tracks: [] }] }) },
        thumbnail: t.thumbnail
      })),
      getEvolutionJsonTransitionsOverlay: async () => []
    },
    uiStore: {
      toggleRightBlock: () => {},
      secondaryWindowType: '16:9',
      setOverlayType: () => {}
    },
    projectStore: {
      addData: () => {},
      item: { ratio: { width: 16, height: 9 } }
    },
    presetStore: {
      setPreviewData: () => {},
      updateTime: () => {}
    },
    timelineStore: {
      timelineHeight: 400
    },
    userStore: {
      jsonTransitionEnabled: true,
      evolutionOverlayEnabled: true
    }
  };

  return (
    <div className="timeline-editor-container" style={{
      width: '100%',
      height: '100vh',
      background: '#05070b',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '16px',
        padding: '18px 20px',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(135deg, #171b24 0%, #07090d 45%, #111827 100%)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.85)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform .15s ease, background .15s ease, border-color .15s ease',
            width: '40px',
            height: '40px',
            borderRadius: '12px'
          }}>←</button>
          <div>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'grid', placeItems: 'center', fontSize: '22px',
              border: '1px solid rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.1)', boxShadow: '0 0 16px rgba(56,189,248,0.12)' }}>
              🎬
            </div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '.04em' }}>TIMELINE</div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.25em', color: 'rgba(255,255,255,0.4)' }}>AI Video Editor</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700' }}>Untitled Project</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Working timeline preview</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '420px' }}>
          {/* Top actions */}
        </div>
      </header>

      {/* Main content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '16px',
        flex: 1,
        minHeight: 0
      }}>
        {/* Left side - Timeline */}
        <div style={{ minWidth: 0 }}>
          {/* Preview area */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '16px',
            borderRadius: '28px',
            aspectRatio: '16 / 9',
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#000',
            boxShadow: '0 0 70px rgba(56,189,248,0.14)'
          }}>
            <div style={{
              position: 'absolute',
              inset: '24px',
              borderRadius: '22px',
              border: '1px solid rgba(34,211,238,0.15)',
              background: 'linear-gradient(135deg, rgba(20,25,33,0.9), rgba(8,10,14,0.86))',
              boxShadow: '0 0 60px rgba(34,211,238,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '72px', marginBottom: '10px' }}>🎥</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'rgba(255,255,255,0.92)' }}>Center Preview</div>
                <div style={{ marginTop: '4px', fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
                  Glow preview styled like the render page
                </div>
              </div>
            </div>
            {/* Overlay controls */}
            <div style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 0,
              padding: '16px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.2), transparent)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                <span>00:12.40</span>
                <span>01:00.00</span>
              </div>
              <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{
                  height: '100%',
                  width: `${playheadPercent}%`,
                  borderRadius: 'inherit',
                  background: 'linear-gradient(to right, #22d3ee, #34d399)'
                }}></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <button style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '999px',
                  border: '1px solid transparent',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer'
                }}>⏮</button>
                <button style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '999px',
                  border: '1px solid transparent',
                  background: 'white',
                  color: 'black',
                  fontWeight: '800',
                  boxShadow: '0 10px 30px rgba(255,255,255,0.15)',
                  cursor: 'pointer'
                }}>▶</button>
                <button style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '999px',
                  border: '1px solid transparent',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer'
                }}>⏹</button>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(20px)',
            padding: '16px'
          }}>
            {/* Timeline header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '.25em',
              color: 'rgba(255,255,255,0.4)'
            }}>
              <div style={{ padding: '10px 12px' }}>Tracks</div>
              <div style={{ padding: '10px 12px' }}>Timeline</div>
            </div>

            {/* Timeline body */}
            <div style={{ position: 'relative' }}>
              {/* Playhead */}
              <div style={{
                position: 'absolute',
                left: '100px',
                right: 0,
                top: 0,
                bottom: 0,
                pointerEvents: 'none'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${playheadPercent}%`,
                  width: '2px',
                  background: '#22d3ee',
                  boxShadow: '0 0 18px rgba(34,211,238,0.8)'
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: `calc(${playheadPercent}% - 4px)`,
                  width: '10px',
                  height: '10px',
                  borderRadius: '999px',
                  background: '#22d3ee',
                  boxShadow: '0 0 15px rgba(34,211,238,0.8)'
                }}></div>
              </div>

              {/* Tracks */}
              {timelineState.tracks.map(track => (
                <div key={track.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr',
                  minHeight: '62px',
                  borderBottom: track.id === timelineState.tracks[timelineState.tracks.length - 1].id ? 'none' : '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{
                    padding: '10px 8px',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.35)'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.86)' }}>
                      {track.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                      <button style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: track.locked ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '8px',
                        cursor: 'pointer'
                      }}>
                        {track.locked ? '🔒' : '🔓'}
                      </button>
                    </div>
                  </div>
                  <div style={{
                    position: 'relative',
                    background: 'rgba(255,255,255,0.02)',
                    minHeight: '62px',
                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)',
                    backgroundSize: '80px 100%'
                  }}>
                    {track.clips.map(clip => (
                      <div
                        key={clip.id}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          bottom: '8px',
                          left: `${clip.left}%`,
                          width: `${clip.width}%`,
                          borderRadius: '12px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '8px 10px',
                          fontSize: '10px',
                          fontWeight: '600',
                          color: 'rgba(255,255,255,0.86)',
                          background: 'rgba(255,255,255,0.1)',
                          boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          // If this is a transition between clips, select it
                          if (clip.type === 'transition') {
                            setSelectedTransitionElement({
                              id: clip.id,
                              popcornOptions: {
                                kind: clip.transitionType || 'fade',
                                start: clip.start,
                                end: clip.end,
                                from: clip.fromClip,
                                to: clip.toClip,
                                fromUrl: clip.fromUrl,
                                toUrl: clip.toUrl,
                                width: 400,
                                height: 300
                              }
                            });
                          }
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {clip.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Side panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Overlay Transitions Panel */}
          <div style={{
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(20px)',
            padding: '14px'
          }}>
            <div style={{
              marginBottom: '12px',
              fontSize: '12px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: 'rgba(255,255,255,0.82)'
            }}>
              🎬 Overlay Transitions
            </div>
            <Provider {...mockStores}>
              <OverlayListTransitions onTransitionSelect={handleTransitionSelect} />
            </Provider>
          </div>

          {/* Video Transition Settings Panel */}
          {selectedTransitionElement && (
            <div style={{
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(20px)',
              padding: '14px'
            }}>
              <div style={{
                marginBottom: '12px',
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                color: 'rgba(255,255,255,0.82)'
              }}>
                🎬 Video Transition Settings
              </div>
              <VideoTransitionSettings
                element={selectedTransitionElement}
                update={mockUpdate}
                fields={mockFields}
                find={mockFind}
              />
            </div>
          )}

          {/* Media Panel */}
          <div style={{
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(20px)',
            padding: '14px'
          }}>
            <div style={{
              marginBottom: '12px',
              fontSize: '12px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              color: 'rgba(255,255,255,0.82)'
            }}>
              📁 Media
            </div>
            <button style={{
              width: '100%',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.72)',
              padding: '11px 14px',
              cursor: 'pointer',
              fontWeight: '700',
              marginBottom: '12px'
            }}>
              Upload
            </button>
            <div style={{
              margin: '-4px 0 10px',
              fontSize: '10px',
              lineHeight: '1.45',
              color: 'rgba(255,255,255,0.46)'
            }}>
              Choose what you want to add to the timeline. Each tile inserts a different type of source asset.
            </div>
          </div>

          {/* Generate Panel */}
          <div style={{
            borderRadius: '20px',
            border: '1px solid rgba(34,211,238,0.2)',
            background: 'linear-gradient(180deg, rgba(56,189,248,0.08), rgba(17,24,39,0.75))',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(20px)',
            padding: '14px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                color: '#bae6fd'
              }}>
                ⚡ Generate
              </div>
            </div>
            <textarea
              style={{
                width: '100%',
                minHeight: '88px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                padding: '10px 12px',
                resize: 'vertical',
                marginBottom: '8px'
              }}
              placeholder="A cinematic shot of..."
            />
            <input
              style={{
                width: '100%',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                padding: '10px 12px',
                marginBottom: '8px'
              }}
              placeholder="Negative prompt"
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <select style={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                padding: '10px 12px'
              }}>
                <option>5s</option>
                <option>8s</option>
                <option>12s</option>
              </select>
              <select style={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                padding: '10px 12px'
              }}>
                <option>16:9</option>
                <option>9:16</option>
                <option>1:1</option>
              </select>
              <select style={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                color: 'white',
                padding: '10px 12px'
              }}>
                <option>Cinematic</option>
                <option>Commercial</option>
                <option>Documentary</option>
              </select>
            </div>
            <button style={{
              width: '100%',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(to right, #22d3ee, #34d399)',
              color: '#03131a',
              padding: '11px 14px',
              cursor: 'pointer',
              fontWeight: '700'
            }}>
              ⚡ Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});