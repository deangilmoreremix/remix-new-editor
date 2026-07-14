import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

FACELESS_VIDEO_CREATOR_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "prompt": {"type": "string", "description": "Script text to generate video from"},
        "duration": {"type": "integer", "description": "Duration of the generated video in seconds", "default": 30},
    },
    "required": ["collection_id", "prompt"],
}


class FacelessVideoCreatorAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "faceless_video_creator"
        self.description = "Generate a faceless video from a script prompt."
        self.parameters = FACELESS_VIDEO_CREATOR_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, prompt: str, duration: int = 30, *args, **kwargs):
        try:
            self.output_message.actions.append("Generating video from prompt...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset
            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            gen = videodb_tool.generate_video(prompt, duration)
            generated_video_id = gen.get("id")
            timeline = Timeline(videodb_tool.conn)
            track = Track()
            track.add_clip(0, Clip(asset=VideoAsset(id=generated_video_id, start=0)))
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
