import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import Session, MsgStatus, VideoContent, VideoData
from director.tools.videodb_tool import VideoDBTool
from videodb import IndexType

logger = logging.getLogger(__name__)

VISUAL_SEARCH_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "The collection ID to search within",
        },
        "query": {
            "type": "string",
            "description": "Natural language visual query (e.g. 'a person wearing red')",
        },
    },
    "required": ["collection_id", "query"],
}


class VisualSearchAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "visual_search"
        self.description = (
            "Finds moments in videos using multimodal (visual) search. "
            "Use when a user wants to find content by what is shown on screen, not just spoken words."
        )
        self.parameters = VISUAL_SEARCH_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(self, collection_id: str, query: str, *args, **kwargs):
        try:
            self.output_message.actions.append(f"Visually searching for '{query}'...")
            self.output_message.push_update()

            video_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Searching visually...",
            )
            self.output_message.content.append(video_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)
            results = videodb_tool.semantic_search(
                query=query, index_type=IndexType.scene
            )

            video_content.status = MsgStatus.success
            video_content.status_message = "Visual search complete."
            self.output_message.publish()

        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            video_content.status = MsgStatus.error
            video_content.status_message = "Error performing visual search."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Visual search completed.",
            data={"results": str(results)},
        )
