import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

PREVIEW_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video to generate a preview for"},
        "duration": {"type": "integer", "description": "Preview length in seconds", "default": 15},
    },
    "required": ["collection_id", "video_id"],
}


class PreviewAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "preview"
        self.description = "Generates a short preview/teaser clip from the start of a video."
        self.parameters = PREVIEW_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, duration: int = 15, *args, **kwargs):
        try:
            self.output_message.actions.append("Generating preview...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                 status_message="Composing preview...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            track = Track()
            clip = Clip(asset=VideoAsset(id=video_id, start=0), duration=min(duration, 60))
            track.add_clip(0, clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Preview ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Preview failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Preview generated.",
                                 data={"stream_url": stream_url})
