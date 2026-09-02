import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

ENHANCER_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video to enhance"},
        "filter": {"type": "string", "enum": ["boost", "contrast", "lighten"], "default": "boost"},
    },
    "required": ["collection_id", "video_id"],
}


class EnhancerAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "enhancer"
        self.description = "Enhances video quality by applying a boost/contrast filter via the timeline."
        self.parameters = ENHANCER_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, filter: str = "boost", *args, **kwargs):
        try:
            self.output_message.actions.append("Enhancing video...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset, Filter

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                 status_message="Enhancing...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            track = Track()
            clip = Clip(asset=VideoAsset(id=video_id, start=0), filter=getattr(Filter, filter, Filter.boost))
            track.add_clip(0, clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Video enhanced."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Enhancement failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Video enhanced.",
                                 data={"stream_url": stream_url})
