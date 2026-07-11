import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

SCENES_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "video_id": {
            "type": "string",
            "description": "Video ID to detect scenes in",
        },
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "extraction_type": {
            "type": "string",
            "description": "Type of scene detection",
            "enum": ["shot_based", "time_based"],
            "default": "shot_based",
        },
        "threshold": {
            "type": "number",
            "description": "Threshold for scene change detection",
            "default": 20,
        },
        "min_scene_len": {
            "type": "number",
            "description": "Minimum scene length in frames",
            "default": 15,
        },
        "frame_count": {
            "type": "integer",
            "description": "Number of frames to extract per scene",
            "default": 4,
        },
    },
    "required": ["video_id", "collection_id"],
}


class ScenesAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "scenes"
        self.description = "Identify scene boundaries and detect scenes in a video"
        self.parameters = SCENES_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        video_id: str,
        collection_id: str,
        extraction_type: str = "shot_based",
        threshold: float = 20,
        min_scene_len: float = 15,
        frame_count: int = 4,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Detect scenes in a video.

        :param str video_id: The video ID to process.
        :param str collection_id: The collection ID to use.
        :param str extraction_type: Extraction type.
        :param float threshold: Scene change threshold.
        :param float min_scene_len: Minimum scene length.
        :param int frame_count: Frames per scene.
        :return: The response with scene data.
        :rtype: AgentResponse
        """
        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Detecting scenes..")
            text_content = TextContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Analyzing video for scene boundaries..",
            )
            self.output_message.content.append(text_content)
            self.output_message.push_update()

            extraction_config = {
                "threshold": threshold,
                "min_scene_len": min_scene_len,
                "frame_count": frame_count,
            }

            scene_index_id = videodb_tool.index_scene(
                video_id=video_id,
                extraction_type=extraction_type,
                extraction_config=extraction_config,
                prompt=None,
            )

            scenes = videodb_tool.get_scene_index(
                video_id=video_id,
                scene_id=scene_index_id,
            )

            text_content.text = f"Detected {len(scenes) if isinstance(scenes, list) else 'multiple'} scenes"
            text_content.status = MsgStatus.success
            text_content.status_message = "Scene detection complete"
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            text_content.status = MsgStatus.error
            text_content.status_message = "Error detecting scenes."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Scene detection completed successfully.",
            data={
                "scene_index_id": scene_index_id,
                "scenes": scenes,
            },
        )
