import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

BR0LL_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Main video to add B-roll into"},
        "broll_video_id": {"type": "string", "description": "B-roll footage to overlay"},
        "start": {"type": "integer", "description": "Start time of B-roll overlay", "default": 0},
    },
    "required": ["collection_id", "video_id", "broll_video_id"],
}


class BRollAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "broll"
        self.description = "Overlays B-roll footage on top of a main video at a given timestamp using the timeline compositor."
        self.parameters = BR0LL_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, broll_video_id: str, start: int = 0, *args, **kwargs):
        try:
            self.output_message.actions.append("Compositing B-roll...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                             status_message="Compositing...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            main = Track()
            main.add_clip(0, Clip(asset=VideoAsset(id=video_id, start=0)))
            timeline.add_track(main)

            overlay = Track()
            overlay.add_clip(start, Clip(asset=VideoAsset(id=broll_video_id, start=0),
                                      opacity=0.6, fit="cover"))
            timeline.add_track(overlay)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "B-roll added."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "B-roll failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="B-roll overlay added.",
                                 data={"stream_url": stream_url})
