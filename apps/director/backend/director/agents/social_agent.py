import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

SOCIAL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video to turn into a social clip"},
        "aspect_ratio": {"type": "string", "enum": ["9:16", "1:1", "16:9"], "default": "9:16"},
    },
    "required": ["collection_id", "video_id"],
}


class SocialAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "social"
        self.description = "Creates a short-form social media clip from a video, formatted for TikTok/Reels/Shorts."
        self.parameters = SOCIAL_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, aspect_ratio: str = "9:16", *args, **kwargs):
        try:
            self.output_message.actions.append("Composing social clip...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                status_message="Composing...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            video = videodb_tool.get_video(video_id)
            duration = float(video.get("length", 30))

            timeline = Timeline(videodb_tool.conn)
            timeline.resolution = aspect_ratio
            track = Track()
            clip = Clip(asset=VideoAsset(id=video_id, start=0), duration=min(duration, 60))
            track.add_clip(0, clip)
            timeline.add_track(track)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Social clip ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Social clip failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Social clip created.",
                                 data={"stream_url": stream_url})
