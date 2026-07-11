import logging

from director.agents.base import BaseAgent, AgentResponse, AgentStatus
from director.core.session import (
    Session,
    MsgStatus,
    SearchResultsContent,
    SearchData,
    ShotData,
    VideoContent,
    VideoData,
    TextContent,
)
from director.tools.videodb_tool import VideoDBTool

logger = logging.getLogger(__name__)

VISUAL_SEARCH_AGENT_PARAMETERS = {
    "type": "object",
    "properties": {
        "collection_id": {
            "type": "string",
            "description": "Collection ID to search in",
        },
        "query": {
            "type": "string",
            "description": "Visual/semantic query describing what to find",
        },
        "index_type": {
            "type": "string",
            "enum": ["spoken_word", "scene"],
            "description": "Type of index to search. scene = visual description, spoken_word = transcript",
            "default": "scene",
        },
        "video_id": {
            "type": "string",
            "description": "Optional video ID to limit search to a specific video",
            "default": None,
        },
    },
    "required": ["collection_id", "query"],
}


class VisualSearchAgent(BaseAgent):
    def __init__(self, session: Session, **kwargs):
        self.agent_name = "visual_search"
        self.description = "Perform visual/semantic search across videos to find clips matching a visual query"
        self.parameters = VISUAL_SEARCH_AGENT_PARAMETERS
        super().__init__(session=session, **kwargs)

    def run(
        self,
        collection_id: str,
        query: str,
        index_type: str = "scene",
        video_id: str = None,
        *args,
        **kwargs,
    ) -> AgentResponse:
        """
        Perform visual/semantic search across videos.

        :param str collection_id: The collection ID to search in.
        :param str query: The visual query to search for.
        :param str index_type: Type of index (scene or spoken_word).
        :param str video_id: Optional video ID to limit search.
        :return: The response containing search results and compilation.
        :rtype: AgentResponse
        """
        try:
            self.output_message.actions.append("Performing visual search..")
            search_result_content = SearchResultsContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Searching visually..",
            )
            self.output_message.content.append(search_result_content)
            self.output_message.push_update()

            videodb_tool = VideoDBTool(collection_id=collection_id)

            search_results = videodb_tool.semantic_search(
                query=query,
                index_type=index_type,
                video_id=video_id,
            )

            shots = search_results.get_shots()
            if not shots:
                search_result_content.status = MsgStatus.error
                search_result_content.status_message = "No visual matches found."
                return AgentResponse(
                    status=AgentStatus.ERROR,
                    message="No results found for visual search.",
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
                    "search_score": shot.get("search_score"),
                })

            search_result_content.search_results = [
                SearchData(
                    video_id=sr["video_id"],
                    video_title=sr["video_title"],
                    stream_url=sr["stream_url"],
                    duration=sr["duration"],
                    shots=[ShotData(**shot) for shot in sr["shots"]],
                )
                for sr in result_videos.values()
            ]
            search_result_content.status = MsgStatus.success
            search_result_content.status_message = "Visual search completed."
            self.output_message.publish()

            self.output_message.actions.append("Compiling visual search results..")
            self.output_message.push_update()

            compilation_content = VideoContent(
                agent_name=self.agent_name,
                status=MsgStatus.progress,
                status_message="Building compilation..",
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
            search_result_content.status_message = "Error in visual search."
            self.output_message.publish()
            return AgentResponse(status=AgentStatus.ERROR, message=str(e))

        return AgentResponse(
            status=AgentStatus.SUCCESS,
            message="Visual search completed successfully.",
            data={
                "stream_url": stream_url,
                "results": result_videos,
            },
        )
