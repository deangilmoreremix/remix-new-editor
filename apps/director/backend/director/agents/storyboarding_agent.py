import logging

from videodb import SceneExtractionType

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

STORYBOARDING_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video ID"},
        "max_scenes": {"type": "integer", "description": "Maximum number of scenes to include", "default": 8},
    },
    "required": ["collection_id", "video_id"],
}


class StoryboardingAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "storyboarding"
        self.description = "Build a storyboard montage from a video's scenes."
        self.parameters = STORYBOARDING_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, max_scenes: int = 8, *args, **kwargs):
        try:
            self.output_message.actions.append("Indexing scenes...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset
            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            videodb_tool.index_scene(video_id, extraction_type=SceneExtractionType.shot_based)
            scenes = videodb_tool.list_scene_index(video_id) or []
            scenes = scenes[:max_scenes]
            timeline = Timeline(videodb_tool.conn)
            track = Track()
            for scene in scenes:
                start = int(scene.get("start_time", 0))
                end = int(scene.get("end_time", 5))
                duration = max(end - start, 1)
                track.add_clip(start, Clip(asset=VideoAsset(id=video_id, start=start, duration=duration)))
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
