import subprocess
import shlex
import os
import sys
import shutil
from logging import debug, info, warning, error, critical, exception

class ServerManager:
    def __init__(self, folder, db):
        self.folder = folder
        self.db = db
        self.servers = {}
    
    def start_server(self, name):
        spec = self.db.servers.find_one({'name': name})
        if not spec:
            raise KeyError(f'Server {name} does not exist.')
        args = shlex.split(f'{shutil.which("java")} -Xmx{spec["max_memory"]}g -Xms1g {spec["java_args"]} -jar server.jar nogui')
        info(f'Starting server with args {args}')
        self.servers[name] = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=sys.stdout, universal_newlines=True, cwd=os.path.join(self.folder, name))
    
    def command_server(self, name, command='say hi'):
        if name in self.servers.keys():
            self.servers[name].stdin.write(command+'\n')
        else:
            raise KeyError(f'Server {name} is not online.')
    
    def stop_server(self, name):
        self.command_server(name, command='stop')
