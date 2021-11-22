from json.decoder import JSONDecodeError
from fastapi import FastAPI, Response, Request
from fastapi.staticfiles import StaticFiles
from argparse import ArgumentParser
from starlette.status import *
from starlette.responses import FileResponse, JSONResponse
import uvicorn
import os
from pymongo import MongoClient
from pymongo.database import Database
import json
from util import fetch_jarinfo, defaults
import logging
from logging import debug, info, warning, error, critical, exception
import threading
import time
from models import *
import hashlib
import random
import server_manager
import requests
import base64

AUTHENTICATED_CONNECTIONS = {}

def fetch_loop(db: Database):
    WAIT = 12 # Delay between fetches (hours)
    while True:
        info('Fetching minecraft version info.')
        jar_info = fetch_jarinfo()
        jar_info['record'] = 'versions'
        info('Found {mc} vanilla versions and {paper} papermc versions. Latest version is {latest}. Latest snapshot is {latest_snap}.'.format(
            mc=str(len(jar_info['vanilla'])),
            paper=str(len(jar_info['paper'])),
            latest=jar_info['latest']['release'],
            latest_snap=jar_info['latest']['snapshot']
        ))
        db.versions.replace_one({'record': 'versions'}, jar_info, upsert=True)
        time.sleep(WAIT * 3600)


if __name__ == '__main__':
    parser = ArgumentParser(description='Run minecraft-socket server.')
    parser.add_argument('--config', default='config.json', help='Path to config file (JSON)')
    args = parser.parse_args()

    try:
        with open(args.config, 'r') as c:
            os.environ['MC-CONFIG'] = json.dumps(json.load(c))
    except JSONDecodeError:
        print('FATAL: Bad JSON structure.')
        exit(0)
    except FileNotFoundError:
        print(f'FATAL: {args.config} not found.')
        exit(0)
    
    CONF = json.loads(os.environ['MC-CONFIG'])
    uvicorn.run('main:app', host=CONF['runtime']['host'], port=CONF['runtime']['port'], access_log=False)

else:
    try:
        CONFIG = json.loads(os.environ['MC-CONFIG'])
    except:
        print(f'FATAL: config not loaded.')
        exit(0)
    logging.basicConfig(
        format=CONFIG["logging"]["format"],
        level=logging.getLevelName(CONFIG["logging"]["level"].upper()),
    )

    info('Loading connection to DB')
    db = CONFIG['database']
    mongodb = MongoClient(
        host=db['ip'],
        port=db['port'],
        username=db['username'],
        password=db['password'],
        tls=db['secure']
    )
    database = mongodb.minecraft_socket

    info('Starting fetch thread.')
    fetch_thread = threading.Thread(target=fetch_loop, name='mcjar_fetch_thread', daemon=True, args=[database])
    fetch_thread.start()

    info('Checking env setup.')
    if not os.path.exists(CONFIG['server_folder']):
        os.makedirs(CONFIG['server_folder'])
    
    info('Starting server manager.')
    manager = server_manager.ServerManager(CONFIG['server_folder'], database)


app = FastAPI()
app.mount('/web', StaticFiles(directory='web'), 'staticfiles')

@app.get('/')
async def get_index():
    return FileResponse(os.path.join('web', 'index.html'))

@app.middleware('http')
async def auth(request: Request, call_next):
    for k in list(AUTHENTICATED_CONNECTIONS.keys()):
        if AUTHENTICATED_CONNECTIONS[k]+CONFIG['connection_timeout'] < time.time():
            del AUTHENTICATED_CONNECTIONS[k]
            
    if request.url.path == '/' or request.url.path.startswith('/web') or request.url.path == '/auth':
        return await call_next(request)
    else:
        if 'x-authkey' in request.headers.keys():
            if request.headers['x-authkey'] in AUTHENTICATED_CONNECTIONS.keys():
                return await call_next(request)
            else:
                return JSONResponse({'result': 'failure', 'reason': 'Auth key not recognized.'}, HTTP_403_FORBIDDEN)
        else:
            return JSONResponse({'result': 'failure', 'reason': 'Auth key not passed in headers.'}, HTTP_403_FORBIDDEN)

@app.post('/auth')
async def post_auth(request: Request, response: Response):
    model = await request.json()
    hashed_pass = hashlib.sha256(CONFIG['password'].encode('utf-8')).hexdigest()
    if hashed_pass == model['passhash']:
        cid = hashlib.sha256(str(time.time()+random.random()).encode('utf-8')).hexdigest()
        AUTHENTICATED_CONNECTIONS[cid] = time.time()
        return {'result': 'success', 'connection_id': cid}
    else:
        response.status_code = HTTP_403_FORBIDDEN
        return {'result': 'failure', 'reason': 'Incorrect passcode.'}

@app.get('/versions')
async def get_versions(response: Response, request: Request):
    try:
        res = database.versions.find_one({'record': 'versions'})
        del res['_id']
        del res['record']
        return res
    except:
        return {
            'latest': {'release': None, 'snapshot': None},
            'paper': {},
            'vanilla': {}
        }

@app.post('/servers/new')
async def new_server(req: Request, res: Response):
    fields = defaults(await req.json(), defs={
        'max_memory': 2, # GB
        'name': f'server_{int(time.time())}',
        'server_port': 25565,
        'server_ip': '',
        'world_seed': '',
        'whitelist': True,
        'max_players': 20,
        'difficulty': 'hard',
        'gamemode': 'survival',
        'motd': 'Minecraft Server Running on Minecraft-Socket [iTecAI]',
        'command_blocks': True,
        'other_args': ''
    }) # also requires {jar: url or base-64 encoded jar}
    if os.path.exists(os.path.join(CONFIG['server_folder'], fields['name'])):
        res.status_code = HTTP_405_METHOD_NOT_ALLOWED
        return {'result': 'failure', 'reason': f'Server {fields["name"]} already exists.'}
    if not 'jar' in fields.keys():
        res.status_code = HTTP_400_BAD_REQUEST
        return {'result': 'failure', 'reason': 'Server jar not specified'}
    
    info(f'Creating new server {fields["name"]} running at {fields["server_ip"]}:{fields["server_port"]}.')
    os.mkdir(os.path.join(CONFIG['server_folder'], fields['name']))
    with open(os.path.join(CONFIG['server_folder'], fields['name'], 'eula.txt'), 'w') as f:
        f.write('eula=true')
    with open('server.properties.template', 'r') as f:
        properties = f.read().format(
            gamemode=fields['gamemode'],
            cmdblocks='true' if fields['command_blocks'] else 'false',
            motd=fields['motd'],
            seed=fields['world_seed'],
            difficulty=fields['difficulty'],
            max_players=str(fields['max_players']),
            server_ip=fields['server_ip'],
            server_port=str(fields['server_port']),
            whitelist='true' if fields['whitelist'] else 'false'
        )
    with open(os.path.join(CONFIG['server_folder'], fields['name'], 'server.properties'), 'w') as f:
        f.write(properties)
    database.servers.insert_one({
            'max_memory': fields['max_memory'],
            'name': fields['name'],
            'java_args': fields['other_args'],
            'address': fields['server_ip']+':'+str(fields['server_port']),
            'enabled': True
        })
    
    if 'https://' in fields['jar'] or 'http://' in fields['jar']:
        response = requests.get(fields['jar'], stream=True)
        with open(os.path.join(CONFIG['server_folder'], fields['name'], 'server.jar'), 'wb') as fd:
            for chunk in response.iter_content(chunk_size=128):
                fd.write(chunk)
    
    manager.start_server(fields['name'])
    
    return {'result': 'success'}