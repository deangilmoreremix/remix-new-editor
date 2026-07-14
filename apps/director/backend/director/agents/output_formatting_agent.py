import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

OUTPUT_FORMATTING_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video ID"},
        "aspect_ratio": {
            "type": "string",
            "enum": ["9:16", "1:1", "16:9"],
            "description": "Target output aspect ratio",
            "default": "16:9",
        },
    },
    "required": ["collection_id", "video_id"],
}


class OutputFormattingAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "output_formatting"
        self.description = (
            "Reformat a video to a target aspect ratio. Resolution/formatting is "
            "supported directly by the timeline."
        )
        self.parameters = OUTPUT_FORMATTING_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, aspect_ratio: str = "16:9", *args, **kwargs):
        try:
            self.output_message.actions.append(f"Formatting output to {aspect_ratio}...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            timeline.resolution = aspect_ratio
            track = Track()
            track.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0)))
            timeline.add_track(track)
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
