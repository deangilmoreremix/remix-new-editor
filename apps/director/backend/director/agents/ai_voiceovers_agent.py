import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

AI_VOICEOVERS_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video ID"},
        "script": {"type": "string", "description": "Script text to turn into voiceover"},
        "voice_name": {"type": "string", "description": "Voice name to use", "default": "alloy"},
    },
    "required": ["collection_id", "video_id", "script"],
}


class AIVoiceoversAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "ai_voiceovers"
        self.description = "Generate an AI voiceover and overlay it on a video."
        self.parameters = AI_VOICEOVERS_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, script: str, voice_name: str = "alloy", *args, **kwargs):
        try:
            self.output_message.actions.append("Generating voiceover...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset
            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            voice = videodb_tool.generate_voice(script, voice_name)
            audio_id = voice.get("id")
            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            video_track.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0)))
            timeline.add_track(video_track)
            audio_track = Track()
            audio_track.add_clip(0, Clip(asset=AudioAsset(id=audio_id, start=0)))
            timeline.add_track(audio_track)
            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Done."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))
        return AgentResponse(status=AgentStatus.SUCCESS, message="Done.", data={"stream_url": stream_url})
