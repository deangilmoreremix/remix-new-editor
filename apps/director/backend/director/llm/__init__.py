import os

from director.constants import LLMType

from director.llm.openai import OpenAI
from director.llm.anthropic import AnthropicAI
from director.llm.googleai import GoogleAI
from director.llm.videodb_proxy import VideoDBProxy
from director.utils.keys import get_key


def get_default_llm():
    """Get default LLM"""

    openai = True if get_key("OPENAI_API_KEY") else False
    anthropic = True if get_key("ANTHROPIC_API_KEY") else False
    googleai = True if get_key("GOOGLEAI_API_KEY") else False

    default_llm = os.getenv("DEFAULT_LLM")

    if openai or default_llm == LLMType.OPENAI:
        return OpenAI()
    elif anthropic or default_llm == LLMType.ANTHROPIC:
        return AnthropicAI()
    elif googleai or default_llm == LLMType.GOOGLEAI:
        return GoogleAI()
    else:
        return VideoDBProxy()
