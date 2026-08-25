import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

MONTAGE_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Long video to build a montage from"},
        "max_clips": {"type": "integer", "description": "Max number of highlights", "default": 8},
    },
    "required": ["collection_id", "video_id"],
}


class MontageAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "montage"
        self.description = "Auto-builds a highlight montage from a long video by detecting the best moments."
        self.parameters = MONTAGE_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, max_clips: int = 8, *args, **kwargs):
        try:
            self.output_message.actions.append("Building montage...")
            self.output_message.push_update()
            from videodb.editor import Timeline, Track, Clip, VideoAsset
            from videodb import IndexType, SceneExtractionType

            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress,
                                                 status_message="Composing montage...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            videodb_tool.index_scene(video_id=video_id, extraction_type=SceneExtractionType.shot_based)
            scenes = videodb_tool.list_scene_index(video_id)

            timeline = Timeline(videodb_tool.conn)
            track = Track()
            start = 0
            for scene in scenes[:max_clips]:
                clip = Clip(asset=VideoAsset(id=video_id, start=int(scene.get("start_time", 0))),
                               duration=int(scene.get("end_time", 5)) - int(scene.get("start_time", 0)))
                track.add_clip(start, clip)
                start += int(scene.get("end_time", 5)) - int(scene.get("start_time", 0))
            timeline.add_track(track)

            stream_url = timeline.generate_stream()
            video_content.video = VideoData(stream_url=stream_url)
            video_content.status = MsgStatus.success
            video_content.status_message = "Montage ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Montage failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(status=AgentStatus.SUCCESS, message="Montage created.",
                                 data={"stream_url": stream_url})
