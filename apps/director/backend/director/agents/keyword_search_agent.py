import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    TextContent,
    VideoContent,
    VideoData,
    SearchResultsContent,
    SearchData,
    ShotData,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

KEYWORD_SEARCH_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to search videos in",
        },
        "query": {
            "type": "string",
            "description": "Keyword to search for",
        },
        "result_threshold": {
            "type": "integer",
            "description": "Max number of search results (default: 8)",
            "default": 8,
        },
    },
    "required": ["collection_id", "query"],
}


class KeywordSearchAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "keyword_search"
        self.description = "Search videos by keyword across a collection and compile results"
        self.parameters = KEYWORD_SEARCH_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self, collection_id: str, query: str, result_threshold: int = 8, *args, **kwargs
    ) -> AgentResponse:
        """
        Search videos by keyword and return compiled results.

        :param str collection_id: The collection ID to search in.
        :param str query: The keyword to search for.
        :param int result_threshold: Maximum number of results to return.
        :return: The response containing the search results and compilation.
        :rtype: AgentResponse
        """
        try:
            self.output_message.actions.append("Searching by keyword..")
            search_result_content = TextContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Searching videos..",
            )
            self.output_message.content.append(search_result_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)

            search_results = videodb_tool.keyword_search(
                query=query, result_threshold=result_threshold
            )

            shots = search_results.get_shots()
            if not shots:
                search_result_content.status = MsgStatus.error
                search_result_content.status_message = (
                    f"No results found for query: {query}"
                )
                self.output_message.push_update()
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No results found for keyword search.",
                )

            result_videos = {}
            for shot in shots:
                vid = shot["video_id"]
                if vid not in result_videos:
                    video = videodb_tool.get_video(vid)
                    result_videos[vid] = {
                        "video_id": vid,
                        "video_title": shot["video_title"],
                        "stream_url": video.get("stream_url"),
                        "duration": video.get("length"),
                        "shots": [],
                    }
                result_videos[vid]["shots"].append({
                    "start": shot["start"],
                    "end": shot["end"],
                    "text": shot["text"],
                })

            search_result_content.text = f"Found {len(result_videos)} matching video(s) for '{query}'."
            search_result_content.status = MsgStatus.success
            search_result_content.status_message = "Keyword search done."
            self.output_message.publish()

            compilation_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Building compilation clip..",
            )
            self.output_message.content.append(compilation_content)
            self.output_message.push_update()

            stream_url = search_results.compile()
            compilation_content.video = VideoData(stream_url=stream_url)
            compilation_content.status = MsgStatus.success
            compilation_content.status_message = "Compilation ready."
            self.output_message.publish()
        except Exception as e:
            logger.exception(f"Error in {self.agent_name} agent.")
            search_result_content.status = MsgStatus.error
            search_result_content.status_message = "Error in keyword search."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))
        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Keyword search and compilation completed.",
            data={
                "stream_url": stream_url,
                "results": result_videos,
            },
        )
