import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

STORY_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_ids": {"type": "array", "description": "Ordered list of video IDs forming the story"},
        "narration": {"type": "string", "description": "Optional narration text", "default": None},
    },
    "required": ["collection_id", "video_ids"],
}


class StoryAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "story"
        self.description = "Builds a narrative story by sequencing multiple clips into one cohesive video."
        self.parameters = STORY_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_ids: list, narration: str = None, *args, **kwargs):
        try:
            self.output_message.actions.append("Building story...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset, AudioAsset

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                status_message="Composing story...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            timeline = Timeline(videodb_tool.conn)
            track = Track()
            start = 0
            for vid in video_ids:
                video = videodb_tool.get_video(vid)
                dur = float(video.get("length", 30))
                clip = Clip(asset=VideoAsset(id=vid, start=0), duration=dur)
                track.add_clip(start, clip)
                start += dur
            timeline.add_track(track)

            if narration:
                audio = videodb_tool.generate_voice(text=narration, voice_name="alloy")
                at = Track()
                at.add_clip(0, Clip(asset=AudioAsset(id=audio.get("id"), start=0)))
                timeline.add_track(at)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Story ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Story failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Story created.",
                                 data={"stream_url": stream_url})
