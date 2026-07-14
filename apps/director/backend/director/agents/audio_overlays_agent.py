import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

AUDIO_OVERLAYS_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video to add audio overlay to"},
        "prompt": {"type": "string", "description": "Description of the music or sound effect"},
        "duration": {"type": "integer", "description": "Length of overlay in seconds", "default": 15},
        "audio_type": {"type": "string", "enum": ["music", "sfx"], "default": "music"},
    },
    "required": ["collection_id", "video_id", "prompt"],
}


class AudioOverlaysAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "audio_overlays"
        self.description = "Adds AI-generated background music or sound effects on top of a video using the timeline."
        self.parameters = AUDIO_OVERLAYS_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, prompt: str, duration: int = 15, audio_type: str = "music",
            *args, **kwargs):
        try:
            self.output_message.actions.append("Generating audio overlay...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                             status_message="Compositing audio...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            if audio_type == "sfx":
                audio = videodb_tool.generate_sound_effect(prompt=prompt, duration=duration)
            else:
                audio = videodb_tool.generate_music(prompt=prompt, duration=duration)
            audio_id = audio.get("id") if isinstance(audio, dict) else getattr(audio, "id", None)

            timeline = Timeline(videodb_tool.conn)
            vt = Track()
            vt.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0)))
            timeline.add_track(vt)
            at = Track()
            at.add_clip(0, Clip(asset=AudioAsset(id=audio_id, start=0), volume=0.5))
            timeline.add_track(at)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Audio overlay added."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Audio overlay failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Audio overlay added.",
                                 data={"stream_url": stream_url})
