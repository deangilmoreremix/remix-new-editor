import os

from flask import current_app as app
from flask_socketio import Namespace

from director.db import load_db
from director.handler import ChatHandler
from director.utils.keys import set_request_keys


class ChatNamespace(Namespace):
    """Chat namespace for socket.io"""

    def on_chat(self, message):
        """Handle chat messages"""
        if isinstance(message, dict):
            # BYOK: keys live only in this request's context; never stored or logged.
            set_request_keys(message.pop("api_keys", None))
        chat_handler = ChatHandler(
            db=load_db(os.getenv("SERVER_DB_TYPE", app.config["DB_TYPE"]))
        )
        chat_handler.chat(message)
