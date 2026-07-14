import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

MUSICVIDEO_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "prompt": {"type": "string", "description": "Music video concept/prompt for visuals"},
        "duration": {"type": "integer", "description": "Video duration in seconds", "default": 30},
    },
    "required": ["collection_id", "prompt"],
}


class MusicVideoAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "musicvideo"
        self.description = "Creates a music video by generating synced visuals from a prompt using AI video generation."
        self.parameters = MUSICVIDEO_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, prompt: str, duration: int = 30, *args, **kwargs):
        try:
            self.output_message.actions.append("Generating music video...")
            self.output_message.push_update()

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                 status_message="Generating visuals...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            from videodb.editor import Timeline, Track, Clip, VideoAsset

            video = videodb_tool.generate_video(prompt=prompt, duration=duration)
            video_id = video.get("id") if isinstance(video, dict) else getattr(video, "id", None)

            timeline = Timeline(videodb_tool.conn)
            track = Track()
            track.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0), duration=duration))
            timeline.add_track(track)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Music video ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Music video failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Music video created.",
                                 data={"stream_url": stream_url})
