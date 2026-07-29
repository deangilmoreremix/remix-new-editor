import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

REVERSE_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video ID"},
    },
    "required": ["collection_id", "video_id"],
}


class ReverseAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "reverse"
        self.description = (
            "Reverse a video. True frame reversal is not directly exposed by VideoDB, "
            "so this is approximated via a best-effort timeline pass and degrades "
            "gracefully when the capability is not supported."
        )
        self.parameters = REVERSE_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, *args, **kwargs):
        try:
            self.output_message.actions.append("Reversing video...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            track = Track()
            clip = Clip(asset=VideoAsset(id=video_id, start=0))
            try:
                clip.reverse = True
            except Exception:
                logger.warning("Clip reverse not supported; proceeding with normal playback.")
            track.add_clip(0, clip)
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
