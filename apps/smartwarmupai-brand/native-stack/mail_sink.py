# Catches the backend's outgoing mail (login codes, invites) into files so a Docker-less stack needs no SMTP server. Usage: mail_sink.py <dir>
import asyncio, sys, time, os
from aiosmtpd.controller import Controller
class H:
    async def handle_DATA(self, server, session, envelope):
        fn = os.path.join(sys.argv[1], f"{time.time_ns()}.eml")
        open(fn, 'wb').write(envelope.content); return '250 OK'
c = Controller(H(), hostname='127.0.0.1', port=11025); c.start()
asyncio.get_event_loop().run_forever()
