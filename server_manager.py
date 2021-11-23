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
        for s in self.db.servers.find({'enabled': True}):
            self.start_server(s['name'])
    
    def start_server(self, name):
        spec = self.db.servers.find_one({'name': name})
        if not spec:
            raise KeyError(f'Server {name} does not exist.')
        args = shlex.split(f'{shutil.which("java")} -Xmx{spec["max_memory"]}g -Xms1g {spec["java_args"]} -jar server.jar nogui')
        info(f'Starting server with args {args}')
        self.servers[name] = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, cwd=os.path.join(self.folder, name))
    
    def command_server(self, name, command='say hi'):
        if name in self.servers.keys():
            if self.servers[name].poll() != None:
                del self.servers[name]
                return
            self.servers[name].stdin.write(command+'\n')
            self.servers[name].stdin.flush()
        else:
            raise KeyError(f'Server {name} is not online.')
    
    def stop_server(self, name):
        self.command_server(name, command='stop')
        del self.servers[name]
    
    def get_logs(self, name):
        if name in self.servers.keys():
            if self.servers[name].poll() != None:
                del self.servers[name]
                return
            with open(os.path.join(self.folder, name, 'logs', 'latest.log'), 'r') as f:
                return f.read().split('\n')
        else:
            raise KeyError(f'Server {name} is not online.')
