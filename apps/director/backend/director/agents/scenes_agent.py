import logging

from videodb import SceneExtractionType

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

SCENES_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {"type": "string", "description": "Collection to operate on"},
        "video_id": {"type": "string", "description": "Video ID"},
    },
    "required": ["collection_id", "video_id"],
}


class ScenesAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "scenes"
        self.description = "Index and list scenes of a video."
        self.parameters = SCENES_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, video_id: str, *args, **kwargs):
        try:
            self.output_message.actions.append("Indexing scenes...")
            self.output_message.push_update()
            video_content = VideoContent(agent_name=self.agent_name, status=MsgStatus.progress, status_message="Working...")
            self.output_message.content.append(video_content)
            self.output_message.push_update()
            videodb_tool = VideoDBTool(collection_id=collection_id)
            videodb_tool.index_scene(video_id, extraction_type=SceneExtractionType.shot_based)
            scenes = videodb_tool.list_scene_index(video_id) or []
            video_content.status = MsgStatus.success
            video_content.status_message = "Done."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name}")
            video_content.status = MsgStatus.error
            video_content.status_message = "Failed."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))
        return AgentResponse(status=AgentStatus.SUCCESS, message="Done.", data={"scenes": scenes})
