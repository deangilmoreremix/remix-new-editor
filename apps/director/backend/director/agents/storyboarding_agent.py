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

STORYBOARDING_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to use",
        },
        "script": {
            "type": "string",
            "description": "Script text to generate storyboard from",
        },
        "num_scenes": {
            "type": "integer",
            "description": "Number of scenes to generate",
            "default": 6,
        },
        "aspect_ratio": {
            "type": "string",
            "description": "Aspect ratio for storyboard frames",
            "enum": ["16:9", "9:16", "4:3", "1:1"],
            "default": "16:9",
        },
    },
    "required": ["collection_id", "script"],
}


class StoryboardingAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "storyboarding"
        self.description = "Generate storyboards from scripts"
        self.parameters = STORYBOARDING_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        script: str,
        num_scenes: int = 6,
        aspect_ratio: str = "16:9",
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Generate a storyboard from a script.

        :param str collection_id: The collection ID to use.
        :param str script: The script text.
        :param int num_scenes: Number of scenes.
        :param str aspect_ratio: Aspect ratio.
        :return: The response with storyboard data.
        :rtype: AgentResponse
        """
        try:
            videodb_tool = VideoDBTool(collection_id=collection_id)

            self.output_message.actions.append("Generating storyboard..")
            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Analyzing script..",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            scenes = []
            script_lines = script.strip().split("\n")
            for i, line in enumerate(script_lines[:num_scenes]):
                scenes.append(
                    {
                        "scene_number": i + 1,
                        "description": line.strip(),
                        "shot_type": "medium_shot",
                        "duration": 5,
                    }
                )

            image_ids = []
            for scene in scenes:
                self.output_message.actions.append(
                    f"Generating frame for scene {scene['scene_number']}.."
                )
                self.output_message.push_update()
                image = videodb_tool.generate_image(
                    prompt=scene["description"],
                    aspect_ratio=aspect_ratio,
                )
                image_ids.append(image["id"])

            video_content.status = MsgStatus.success
            video_content.status_message = f"Storyboard generated with {len(scenes)} scenes."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error generating storyboard."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Storyboard generated successfully.",
            data={
                "scenes": scenes,
                "image_ids": image_ids,
            },
        )
