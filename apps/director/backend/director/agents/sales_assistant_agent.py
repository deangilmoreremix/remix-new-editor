import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

SALES_ASSISTANT_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video ID"},
        "cta_text": {"type": "string", "description": "Call-to-action text overlay", "default": "Buy now"},
    },
    "required": ["collection_id", "video_id"],
}


class SalesAssistantAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "sales_assistant"
        self.description = "Overlay a call-to-action (CTA) text on a video for sales promotion."
        self.parameters = SALES_ASSISTANT_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, cta_text: str = "Buy now", *args, **kwargs):
        try:
            self.output_message.actions.append("Overlaying CTA text on video...")
            self.output_message.push_update()
            from videodb.editor import (
                Timeline,
                Track,
                Clip,
                VideoAsset,
                TextAsset,
                Font,
                Background,
                Position,
            )

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            video_track = Track()
            video_track.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0)))
            timeline.add_track(video_track)
            overlay_track = Track()
            text_asset = TextAsset(
                text=cta_text,
                font=Font(size=48, color="white"),
                background=Background(color="rgba(0,0,0,0.5)"),
                position=Position(bottom=10),
            )
            overlay_track.add_clip(0, Clip(asset=text_asset))
            timeline.add_track(overlay_track)
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
